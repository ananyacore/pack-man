// Page controls and Python WebSocket are independent of the optional Three.js scene.
(() => {
  const $=s=>document.querySelector(s);
  const scenarios={
    ddos:{title:'Too many requests',label:'Traffic surge',detail:'Many computers send requests to the same service at once. The service slows down or becomes unavailable.',tip:'Try request throttling: it limits how many requests are handled at once.'},
    dns_spoof:{title:'A fake address',label:'Fake DNS reply',detail:'A forged lookup reply tries to send a user to the wrong address. Signed DNS checks whether the reply is authentic.',tip:'Turn on Signed DNS to reject altered lookup replies.'},
    port_scan:{title:'Searching for open doors',label:'Port probing',detail:'One computer checks which network services answer. A firewall can block unwanted probes.',tip:'Turn on the Firewall to block the probes.'},
    mitm:{title:'Intercepting a message',label:'Traffic interception',detail:'A computer between two others tries to read or change a message. Encryption keeps the contents unreadable.',tip:'Turn on Encryption to protect the message contents.'}
  };
  const defenseNames={firewall:'Firewall',rate_limiter:'Request throttling',dnssec:'Signed DNS',encryption:'Encryption'};
  const counterDefense={ddos:'rate_limiter',dns_spoof:'dnssec',port_scan:'firewall',mitm:'encryption'};
  let scenario='ddos',socket=null,running=false,ticksLeft=0,timer=0,eventCount=0,blocked=0,passed=0,comparison=null,rideEnabled=false,ridePending=false,rideInFlight=false;
  const button=$('#run'),toggles=[...document.querySelectorAll('[data-defense]')],
        cards=[...document.querySelectorAll('.attackBtn')];
  button.disabled=true;$('#packetCount').textContent='0';$('#scoreHint').textContent='SIMULATED PACKETS';

  function addLog(text,tone=''){
    const row=document.createElement('div');row.className=tone;row.textContent=text;
    const list=$('#logItems');list.prepend(row);while(list.children.length>7)list.lastChild.remove();
  }
  const walkthroughs={
    ddos:[
      ['1 · One ordinary request','A visitor asks the web server for a page. The client sends a request and the router forwards it toward the web service. One request is normal; the problem is not the request itself.'],
      ['2 · Many devices repeat it','A group of compromised devices sends requests at nearly the same time. The simulation represents that crowd with several packets. Each request asks the server to do work, so its workload and load can grow.'],
      ['3 · A rate limit sets a pace','Request throttling counts requests during this time slice and lets only a limited number continue. In this demo, the limit resets on the next tick. It reduces a burst; it does not identify who owns every device.'],
      ['4 · Compare the server load','With throttling off, more requests reach the web server and add work. With it on, excess requests are blocked before delivery. Watch the green service node and load meter to compare the effect.']
    ],
    dns_spoof:[
      ['1 · The device needs an address','People use names such as example.com, while computers route traffic using numeric IP addresses. A device asks a DNS resolver to look up the address for a name.'],
      ['2 · A forged answer competes','An attacker tries to make the device accept a false name-to-address answer. If trusted, the device could connect to the attacker’s destination while believing it reached the intended site.'],
      ['3 · The resolver checks trust','Signed DNS validation checks whether the answer has valid cryptographic signatures and belongs to the expected DNS data. This simulation simplifies that into a rule that rejects its marked forged reply.'],
      ['4 · The device uses the accepted answer','A rejected forgery should not replace the trusted result; a valid answer can be used for the connection. Follow the amber DNS service and compare Signed DNS on and off.']
    ],
    port_scan:[
      ['1 · A server has service doors','A port is a numbered endpoint used by a network service. For example, a server may offer web traffic on one port and remote administration on another. A port is a logical connection point, not a physical hole.'],
      ['2 · The scanner checks numbers','A scanner sends small probes to different ports and observes the replies. An answer can suggest a service is listening; no answer may mean closed, filtered, or unreachable. This demo cycles through example numbers; it contacts no real ports and does not model genuine open or closed responses.'],
      ['3 · Rules inspect each probe','A firewall compares traffic with its configured rules. Here, the simplified firewall blocks packets marked as malicious port scans. Real firewall rules can consider addresses, ports, protocols, connection state, and other context.'],
      ['4 · Notice what is revealed','If a probe is blocked, the service does not process it in this simulation. A real scanner learns from the service response; this model only shows whether the firewall blocks the probe, not whether a port is truly open. Scanning is discovery, not automatically a break-in.']
    ],
    mitm:[
      ['1 · The client starts a conversation','A client sends data toward a service through the router. Normally, both sides expect the network to carry the data to the right destination.'],
      ['2 · An interceptor gets between them','A man-in-the-middle position lets an attacker try to observe or alter traffic while pretending to each side that communication is normal. Getting into that position is a separate challenge; this demo starts with an intercepted packet to focus on the risk.'],
      ['3 · Encryption protects the contents','With properly authenticated encryption, a network observer may see that data is moving but should not be able to read or silently change the protected contents. Encryption does not hide every detail, such as the fact that a connection exists.'],
      ['4 · Separate visibility from readability','The message can still travel to its destination while its contents remain protected. The demo models the protection as blocking the marked interception event; real encrypted connections usually protect data rather than make every packet disappear.']
    ]
  };
  let guideIndex=0;
  function showStep(index,where='SCENARIO GUIDE'){if(rideEnabled&&rideInFlight)return;const i=Math.max(0,Math.min(3,index)),item=walkthroughs[scenario][i];guideIndex=i;
    $('#stepNumber').textContent=`STEP 0${i+1} / 04`;$('#stepWhere').textContent=where;
    $('#stepTitle').textContent=item[0];$('#stepText').textContent=item[1];$('#guideStep').textContent=`${i+1} OF 4`;
    $('#stepProgress').style.width=`${(i+1)*25}%`;$('#backStep').disabled=i===0;$('#nextStep').disabled=i===3;
    document.querySelector('.stepPanel').dataset.step=String(i+1);
    window.packetLabState={scenario,index:i};
    window.dispatchEvent(new CustomEvent('walkthrough-step',{detail:{scenario,index:i}}));
  }
  $('#backStep').addEventListener('click',()=>showStep(guideIndex-1));$('#nextStep').addEventListener('click',()=>showStep(guideIndex+1));
  document.querySelector('.walkDetails').addEventListener('toggle',()=>{
    if(document.querySelector('.walkDetails').open)window.dispatchEvent(new CustomEvent('walkthrough-step',{detail:{scenario,index:guideIndex}}));
    else window.dispatchEvent(new CustomEvent('walkthrough-close'));
  });
  function send(data){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data))}
  function setScenario(kind){if(running||!scenarios[kind])return;scenario=kind;const item=scenarios[kind];document.querySelector('.rightbar .metricHead').firstChild.textContent=kind==='dns_spoof'?'DNS SERVICE LOAD ':'WEB SERVICE LOAD ';document.documentElement.style.setProperty('--scenario-accent',({ddos:'#ed8b18',dns_spoof:'#8655d6',port_scan:'#0798ae',mitm:'#df4e7a'})[kind]);
    cards.forEach(card=>card.classList.toggle('active',card.dataset.kind===kind));
    $('#threatValue').textContent='READY';$('#threatBar').style.width='8%';
    eventCount=0;blocked=0;passed=0;$('#packetCount').textContent='0';
    showStep(0,'SCENARIO GUIDE');
    addLog(`${item.label} selected.`,'good');send({action:'select',kind});
  }
  function setLoad(value){const n=Math.max(0,Math.min(100,Number(value)||0));
    $('#loadValue').textContent=String(n).padStart(2,'0');$('#loadBar').style.width=`${n}%`;
    $('#loadLabel').textContent=n>75?'HIGH':n>35?'ACTIVE':'IDLE';
    $('#threatBar').style.width=`${Math.max(8,n)}%`;
  }
  function handle(e){
    if(rideEnabled&&running&&(e.type==='packet'||e.type==='blocked')){e.rideDefense=defenseNames[counterDefense[scenario]];e.rideDefenseEnabled=Boolean(toggles.find(t=>t.dataset.defense===counterDefense[scenario])?.checked);}
    window.dispatchEvent(new CustomEvent('packet-event',{detail:e}));
    if(comparison){if(e.type==='blocked')comparison.current.blocked++;if(e.type==='packet'&&e.packet_kind!=='normal')comparison.current.reached++;if(e.type==='status')comparison.current.load=e.load;}
    if(e.type==='tick'&&!rideInFlight)showStep(0,'TRAFFIC CREATED');
    if(e.type==='packet'||e.type==='blocked'){
      if(!rideInFlight)showStep(e.blocked?2:1,e.blocked?'STOPPED BY DEFENSE':`${(e.target||'router').toUpperCase()} · MOVING`);
      eventCount++;$('#packetCount').textContent=eventCount;
      if(e.blocked){blocked++;$('#threatValue').textContent='BLOCKED';addLog(`Defense active: ${e.message.split(' blocked ')[0]} blocked this packet.`,'good')}
      else if(e.packet_kind!=='normal'){passed++;$('#threatValue').textContent='REACHED SERVICE';
        const msg=e.packet_kind==='dns_spoof'?'Forged address reply reached the DNS service.':
          e.packet_kind==='mitm'?'Intercepted message was not blocked.':'Unexpected request reached the web service.';
        addLog(msg,'bad')
      }else addLog('Expected traffic passed through the network.','good');
    }
    if(e.type==='status'){setLoad(e.load);if(!rideInFlight)showStep(3,`SERVICE LOAD ${String(e.load).padStart(2,'0')} / 100`)}
    if(e.type==='reset'){setLoad(8);$('#threatValue').textContent='READY'}
    if(rideEnabled&&running&&!document.documentElement.classList.contains('has-3d')&&!rideInFlight&&((e.type==='packet'&&e.packet_kind!=='normal')||e.type==='blocked'))startFallbackRide(e);
  }
  function connect(){const scheme=location.protocol==='https:'?'wss:':'ws:';
    socket=new WebSocket(`${scheme}//${location.host}/ws`);
    socket.onopen=()=>{ $('#connection').textContent='CONNECTED';$('#led').style.background='var(--violet)';button.disabled=false;
      send({action:'select',kind:scenario});for(const t of toggles)send({action:'defense',kind:t.dataset.defense,enabled:t.checked});
      $('#logItems').replaceChildren();addLog('Python simulation connected.','good');};
    socket.onmessage=event=>{try{handle(JSON.parse(event.data))}catch{addLog('Received an unreadable simulation event.','bad')}};
    socket.onclose=()=>{button.disabled=true;$('#connection').textContent='RECONNECTING…';$('#led').style.background='var(--red)';if(!running)setTimeout(connect,1500)};
    socket.onerror=()=>socket.close();
  }
  cards.forEach(card=>card.addEventListener('click',()=>setScenario(card.dataset.kind)));
  toggles.forEach(t=>t.addEventListener('change',()=>send({action:'defense',kind:t.dataset.defense,enabled:t.checked})));
  function stop(){running=false;ridePending=false;rideInFlight=false;clearTimeout(timer);document.body.classList.remove('packet-riding');$('#rideControls').hidden=true;hideRidePopup();if(rideEnabled){rideEnabled=false;$('#ride').classList.remove('on');$('#ride').textContent='◎ RIDE PACKET';window.dispatchEvent(new CustomEvent('packet-ride',{detail:{active:false}}))}cards.forEach(c=>c.disabled=false);toggles.forEach(t=>t.disabled=false);$('#compare').disabled=false;button.textContent='▶ RUN SIMULATION';if(comparison){comparison.toggle.checked=comparison.original;send({action:'defense',kind:comparison.key,enabled:comparison.original});comparison=null}}
  function summarize(result){return {outcome:result.blocked?'BLOCKED':result.reached?'REACHED SERVICE':'PASSED',detail:`${result.blocked} stopped · ${result.reached} reached · load ${result.load}/100`}}
  function finishComparison(){const off=summarize(comparison.off),on=summarize(comparison.on),key=comparison.key,toggle=comparison.toggle,original=comparison.original;$('#compareOff').textContent=off.outcome;$('#compareOffDetail').textContent=off.detail;$('#compareOn').textContent=on.outcome;$('#compareOnDetail').textContent=on.detail;$('#compareTitle').textContent=`${defenseNames[key]} · ${scenarios[scenario].label}`;comparison=null;toggle.checked=original;send({action:'defense',kind:key,enabled:original});stop();$('#threatValue').textContent=on.outcome;addLog(`Comparison complete: ${defenseNames[key]} on versus off.`,'good')}
  function step(){if(!running)return;if(ticksLeft<=0){if(comparison&&comparison.phase==='off'){comparison.off=comparison.current;comparison.phase='on';comparison.current={blocked:0,reached:0,load:8};comparison.toggle.checked=true;send({action:'defense',kind:comparison.key,enabled:true});send({action:'select',kind:scenario});$('#compareOff').textContent=summarize(comparison.off).outcome;$('#compareOffDetail').textContent=summarize(comparison.off).detail;$('#compareOn').textContent='RUNNING';$('#compareOnDetail').textContent='Defense on; replaying the same scenario.';$('#compareTitle').textContent=`${defenseNames[comparison.key]} · second run`;ticksLeft=5;showStep(0,'RUN 2 · DEFENSE ON');timer=setTimeout(step,420);return}if(comparison&&comparison.phase==='on'){comparison.on=comparison.current;finishComparison();return}stop();$('#threatValue').textContent=blocked>0&&passed===0?'BLOCKED':passed>0?'REACHED SERVICE':'COMPLETE';addLog('Simulation complete. Select another defense to compare.','good');return}
    ridePending=rideEnabled;send({action:'tick'});ticksLeft--;if(ridePending){timer=setTimeout(()=>{if(ridePending){ridePending=false;rideInFlight=false;document.body.classList.remove('packet-riding');$('#rideControls').hidden=true;step()}},3500);return}timer=setTimeout(step,950)}
  let fallbackStages=[],fallbackStage=0;
  function startFallbackRide(e){
    const narration={
      ddos:[
        'WHAT IS HAPPENING\nSeveral simulated bot clients send requests toward one service at almost the same time. Each request can look ordinary on its own; the harmful part is the shared burst of work.\n\nWHY IT MATTERS\nA real distributed denial-of-service attack uses many compromised or rented devices and may also consume network capacity before traffic reaches the server.\n\nTHIS DEMO\nThe pink packet stands for one request from that crowd. Nothing here creates real traffic.',
        'WHAT IS HAPPENING\nThe router reads the destination address and forwards this request to the next network hop. It moves traffic; it does not decide that the request is harmless just because it can route it.\n\nREAL NETWORKS\nA connection can cross multiple routers operated by different networks. This teaching view draws one edge router to keep the route understandable.',
        'WHAT IS HAPPENING\nRequest throttling counts how many requests arrive in a short window and limits how many the service accepts. Excess requests can be delayed or rejected.\n\nLIMIT\nRate limits reduce bursts, but large distributed attacks can spread traffic across many sources. Real defenses often combine application limits with upstream filtering, caching, and monitoring. This demo uses a simple per-step counter.',
        'WHAT IS HAPPENING\nRequests that pass the checkpoint make the web service do work. As the burst grows, less time and capacity remain for ordinary visitors.\n\nWHAT TO NOTICE\nCompare the load with throttling off and on. The meter is a teaching signal; this simulation does not measure a real server or reproduce a real request queue.'
      ],
      dns_spoof:[
        'WHAT IS HAPPENING\nA device asks the DNS resolver which network address belongs to a site name. DNS is the lookup step that lets people use names while computers connect using addresses.\n\nTHIS DEMO\nThe normal lookup is shown as a simple packet. No public DNS system is contacted.',
        'WHAT IS HAPPENING\nA forged answer claims the site name points to an attacker-chosen address. If a device or resolver accepts and stores it, a later connection could go to the wrong destination.\n\nREAL NETWORKS\nPoisoning can target different caches and depends on how answers are validated and how long they are kept.',
        'WHAT IS HAPPENING\nSigned DNS validation checks that an answer has the expected cryptographic signatures. It helps detect changed or forged DNS data; it does not encrypt the lookup itself.\n\nTHIS DEMO\nThere is no real DNSSEC cryptography here. A simulated marker stands in for the validation result.',
        'WHAT IS HAPPENING\nThe resolver gives the client the accepted address. A false answer could misdirect a later connection; a rejected answer should not replace the trusted result.\n\nTHIS DEMO\nThe scene illustrates that decision only. It does not make DNS queries or store a live cache.'
      ],
      port_scan:[
        'WHAT IS HAPPENING\nA scanner sends small probes to numbered service ports and notes what responds. A port is a logical endpoint that network software uses to offer a service.\n\nWHY IT MATTERS\nThe replies can reveal which services might be available. Discovery is not the same as logging in or exploiting a service.',
        'WHAT IS HAPPENING\nThe router forwards probes toward the target network. It transports the packets; access rules at the firewall or service decide what happens next.\n\nREAL NETWORKS\nScans can use different protocols and timing. This diagram simplifies the path to one router and a few visible probes.',
        'WHAT IS HAPPENING\nThe firewall compares the probe with its rules. A rule can use source and destination, port, protocol, and connection state to allow or reject traffic.\n\nLIMIT\nA firewall reduces exposure but does not patch vulnerable services. This demo simply marks scan packets and applies a teaching rule.',
        'WHAT IS HAPPENING\nOpen, closed, and filtered ports may respond differently in a real scan. Those responses help build an inventory of exposed services.\n\nTHIS DEMO\nIt does not maintain real port states, send probes, or contact another computer.'
      ],
      mitm:[
        'WHAT IS HAPPENING\nA client sends a message toward a service while a simulated interceptor has already gained a position in the route. Reaching that position is a separate real-world step.\n\nRISK\nWithout protection, an intermediary may try to observe or change data in transit.',
        'WHAT IS HAPPENING\nThe router forwards the message toward its destination. An attacker-controlled route could expose traffic to an intermediary, but the router itself is not automatically the attacker.\n\nREAL NETWORKS\nThe route may cross many networks. This scene begins after the interception position has been established.',
        'WHAT IS HAPPENING\nHTTPS uses TLS to authenticate the service and encrypt application data. Authenticated encryption is designed to make silent changes detectable as well as hide contents.\n\nLIMIT\nSome connection details, such as endpoints and timing, may still be visible. This model does not implement TLS; it uses a simplified allow/block result.',
        'WHAT IS HAPPENING\nThe intended service receives the message. The client and service can use protected contents while an intermediary should not be able to read them.\n\nTHIS DEMO\nNo real message is sent, and the interceptor behavior is only a visual teaching model.'
      ]
    };
    const names=scenario==='ddos'?['Bot clients','Edge router','Request control','Web server']:scenario==='dns_spoof'?['Client','DNS server','Signed DNS check','DNS server']:scenario==='port_scan'?['Scanner','Edge router','Firewall','Web server']:['Client','Edge router','Encryption check','Web server'];
    const places=['SOURCE','ROUTER','DEFENSE CHECK',scenario==='dns_spoof'?'DNS SERVER':'WEB SERVER'];
    const accents=['#ef6792','#9270d2','#a6cc35','#35a9bb'];
    const max=e.blocked?3:4;fallbackStages=narration[scenario].slice(0,max).map((text,index)=>({where:places[index],title:names[index],text,index,total:max,final:index===max-1,nodeName:names[index],accent:accents[index]}));fallbackStage=0;ridePending=false;rideInFlight=true;clearTimeout(timer);document.body.classList.add('packet-riding');$('#rideControls').hidden=false;showFallbackRideStage();
  }
  function showFallbackRideStage(){const item=fallbackStages[fallbackStage];if(!item)return;const active=[...$('#fallbackScene').querySelectorAll('.fbnode')].find(n=>n.querySelector('.label')?.textContent.toLowerCase()===item.nodeName.toLowerCase());$('#fallbackScene').querySelectorAll('.fbnode').forEach(n=>n.removeAttribute('data-ride-focus'));if(active)active.dataset.rideFocus='true';window.dispatchEvent(new CustomEvent('ride-stage',{detail:item}))}
  window.addEventListener('ride-continue',()=>{if(document.documentElement.classList.contains('has-3d')||!fallbackStages.length)return;if(fallbackStage<fallbackStages.length-1){fallbackStage++;showFallbackRideStage()}else{fallbackStages=[];$('#fallbackScene').querySelectorAll('.fbnode').forEach(n=>n.removeAttribute('data-ride-focus'));window.dispatchEvent(new CustomEvent('ride-complete',{detail:{cancelled:false}}))}});  let rideToastTimer=0;
  function hideRidePopup(){const popup=$('#ridePopup');popup.classList.remove('visible');clearTimeout(rideToastTimer);setTimeout(()=>{if(!popup.classList.contains('visible'))popup.hidden=true},320);$('#rideControls').hidden=true}
  window.addEventListener('ride-stage',ev=>{ridePending=false;rideInFlight=true;clearTimeout(timer);document.body.classList.add('packet-riding');$('#rideControls').hidden=false;const d=ev.detail;$('#stepNumber').textContent=`STOP 0${d.index+1} / 0${d.total}`;$('#stepWhere').textContent=d.where;$('#stepTitle').textContent=d.title;$('#stepText').textContent=d.text;$('#stepProgress').style.width=`${(d.index+1)/d.total*100}%`;$('#guideStep').textContent=`${d.index+1} OF ${d.total}`;document.querySelector('.stepPanel').dataset.step=String(Math.min(4,d.index+1));$('#rideContinue').textContent=d.final?'FINISH PACKET →':'CONTINUE PACKET →';$('#ridePopupStep').textContent=`${d.where} · ${String(d.index+1).padStart(2,'0')} / ${String(d.total).padStart(2,'0')}`;$('#ridePopupTitle').textContent=d.title;$('#ridePopupText').textContent=d.text;const accent=typeof d.accent==='number'?`#${d.accent.toString(16).padStart(6,'0')}`:(d.accent||'#c9ee68');$('#ridePopup').style.setProperty('--ride-accent',accent);$('#rideControls').hidden=false;const popup=$('#ridePopup');popup.hidden=false;popup.classList.remove('visible');requestAnimationFrame(()=>popup.classList.add('visible'));clearTimeout(rideToastTimer)});
  $('#rideContinue').addEventListener('click',()=>{hideRidePopup();window.dispatchEvent(new CustomEvent('ride-continue'))});
  $('#rideExit').addEventListener('click',()=>$('#ride').click());
  window.addEventListener('ride-complete',ev=>{rideInFlight=false;ridePending=false;clearTimeout(timer);document.body.classList.remove('packet-riding');$('#rideControls').hidden=true;hideRidePopup();if(running)timer=setTimeout(step,ev.detail?.cancelled?250:450)});
  button.addEventListener('click',()=>{if(running){stop();return}running=true;ticksLeft=rideEnabled?1:5;blocked=0;passed=0;eventCount=0;showStep(0,'TRAFFIC CREATED');
    $('#packetCount').textContent='0';$('#threatValue').textContent='RUNNING';
    cards.forEach(c=>c.disabled=true);toggles.forEach(t=>t.disabled=true);button.textContent='Ⅱ PAUSE';
    addLog(`Running: ${scenarios[scenario].label}.`,'good');step()});
  $('#compare').addEventListener('click',()=>{if(running)return;const key=counterDefense[scenario],toggle=toggles.find(t=>t.dataset.defense===key);comparison={key,toggle,original:toggle.checked,phase:'off',current:{blocked:0,reached:0,load:8}};$('#comparePanel').hidden=false;$('#compareTitle').textContent=`${defenseNames[key]} · first run`;$('#compareOff').textContent='RUNNING';$('#compareOffDetail').textContent='Defense off; simulating this incident.';$('#compareOn').textContent='WAITING';$('#compareOnDetail').textContent='The same incident will run again with it on.';running=true;ticksLeft=5;toggle.checked=false;cards.forEach(c=>c.disabled=true);toggles.forEach(t=>t.disabled=true);$('#compare').disabled=true;button.textContent='COMPARING…';$('#threatValue').textContent='COMPARING';send({action:'defense',kind:key,enabled:false});send({action:'select',kind:scenario});showStep(0,'RUN 1 · DEFENSE OFF');step()});
  $('#reset').addEventListener('click',()=>{stop();eventCount=0;blocked=0;passed=0;$('#packetCount').textContent='0';$('#logItems').replaceChildren();
    send({action:'reset'});for(const t of toggles)send({action:'defense',kind:t.dataset.defense,enabled:t.checked});send({action:'select',kind:scenario});
    $('#threatValue').textContent='READY';setLoad(8);addLog('Simulation reset.','good')});
  $('#concepts').addEventListener('click',()=>$('#modal').classList.add('open'));
  $('#ride').addEventListener('click',()=>{rideEnabled=!rideEnabled;const ride=$('#ride');ride.classList.toggle('on',rideEnabled);ride.textContent=rideEnabled?'◉ PACKET STOPS ON':'◎ RIDE PACKET';window.dispatchEvent(new CustomEvent('packet-ride',{detail:{active:rideEnabled}}));if(rideEnabled)addLog('Slow packet walkthrough armed. Run the simulation; each component will wait for you.','good');else{rideInFlight=false;ridePending=false;document.body.classList.remove('packet-riding');$('#rideControls').hidden=true;addLog('Returned to the network overview.','good')}});
  window.addEventListener('impact-flash',e=>{const kind=e.detail?.kind==='blocked'?'impact-blocked':'impact-danger';document.body.classList.remove('impact-blocked','impact-danger');void document.body.offsetWidth;document.body.classList.add(kind);setTimeout(()=>document.body.classList.remove(kind),500)});
  $('#close').addEventListener('click',()=>$('#modal').classList.remove('open'));
  $('#modal').addEventListener('click',e=>{if(e.target.id==='modal')e.currentTarget.classList.remove('open')});

  // The no-WebGL topology remains draggable and zoomable.
  const map=$('#fallbackScene'),svg=map.querySelector('svg');let down=null,rx=-9,ry=-13,scale=1;
  function applyView(){svg.style.transform=`perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`}
  map.addEventListener('pointerdown',e=>{if(e.target.closest('.fbnode'))return;down={x:e.clientX,y:e.clientY,rx,ry};map.setPointerCapture?.(e.pointerId)});
  map.addEventListener('pointermove',e=>{if(down){ry=Math.max(-34,Math.min(34,down.ry+(e.clientX-down.x)*.055));rx=Math.max(-25,Math.min(18,down.rx-(e.clientY-down.y)*.04));applyView()}});
  const nodeHelp={ROUTER:'ROUTER · A traffic director that forwards data toward the right network or service.',CLIENT:'CLIENT · Your computer or phone. It asks network services for pages and information.','BOT CLIENTS':'BOT CLIENTS · Infected devices that create the simulated rush of requests.','WEB SERVER':'WEB SERVER · A computer that stores a site and sends its pages back.','DNS SERVER':'DNS SERVER · The internet’s address book; it finds the numeric address for a site name.'};
  map.querySelectorAll('.fbnode').forEach(node=>{node.addEventListener('pointerenter',e=>{const tip=$('#deviceTip');tip.textContent=nodeHelp[(node.querySelector('.label')?.dataset.name||node.querySelector('.label')?.textContent)]||'Network device';tip.style.left=`${Math.min(innerWidth-330,e.clientX+14)}px`;tip.style.top=`${Math.min(innerHeight-80,e.clientY+14)}px`;tip.classList.add('visible')});node.addEventListener('pointerleave',()=>$('#deviceTip').classList.remove('visible'))});
  map.addEventListener('pointerup',()=>down=null);map.addEventListener('pointercancel',()=>down=null);
  map.addEventListener('wheel',e=>{e.preventDefault();scale=Math.max(.78,Math.min(1.24,scale-e.deltaY*.00045));applyView()},{passive:false});
  map.querySelectorAll('.fbnode').forEach(node=>node.addEventListener('click',()=>{if(down)return;const name=(node.querySelector('.label')?.dataset.name||node.querySelector('.label')?.textContent)||'Network device';const toast=$('#toast');toast.textContent=`${name}: ${({ROUTER:'Forwards packets between networks.',CLIENT:'Sends requests to services.','BOT CLIENTS':'Creates the simulated attack traffic.','WEB SERVER':'Receives and responds to web requests.','DNS SERVER':'Resolves domain names to addresses.'})[name]||'A node in this simulated network.'}`;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2300)}));
  showStep(0);connect();
})();
