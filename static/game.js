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
  let scenario='ddos',socket=null,running=false,ticksLeft=0,timer=0,eventCount=0,blocked=0,passed=0,comparison=null;
  const button=$('#run'),toggles=[...document.querySelectorAll('[data-defense]')],
        cards=[...document.querySelectorAll('.attackBtn')];
  button.disabled=true;$('#packetCount').textContent='0';$('#scoreHint').textContent='SIMULATED PACKETS';

  function addLog(text,tone=''){
    const row=document.createElement('div');row.className=tone;row.textContent=text;
    const list=$('#logItems');list.prepend(row);while(list.children.length>7)list.lastChild.remove();
  }
  const walkthroughs={
    ddos:[['A visitor asks for a page','A normal client sends one request to the web server. The router carries it there.'],['A crowd arrives at once','Many infected computers send requests together. This overload is called a DDoS.'],['The network checks the rush','Request throttling limits how many requests the server accepts in a short time.'],['The server feels the difference','With throttling off, requests pile up. With it on, fewer get through at once.']],
    dns_spoof:[['A device asks for a name','DNS is the internet’s address book: it finds the numeric address for a site name.'],['A fake answer appears','An attacker sends a made-up address, hoping the device will visit the wrong site.'],['The answer is checked','Signed DNS lets the resolver check that the reply came from the real source and was not changed.'],['The device chooses where to go','A valid reply leads to the real service. An unchecked fake reply can send it elsewhere.']],
    port_scan:[['Services have numbered doors','A server offers different services through numbered connection points called ports.'],['A scanner tries the doors','The scanner checks ports one by one to learn which services respond.'],['The firewall checks each try','Firewall rules can reject probes that should not reach those services.'],['The server reveals less','Blocked probes get no useful answer. Allowed probes can reveal which services are open.']],
    mitm:[['A client sends a message','The client starts a connection to the web service through the network.'],['Someone tries to listen in','An interceptor attempts to sit between the client and service and read the passing data.'],['Encryption scrambles the contents','Encryption turns the message into unreadable data unless you have the right key.'],['The message reaches its destination','With encryption on, an interceptor may see traffic but cannot read its contents.']]
  };
  let guideIndex=0;
  function showStep(index,where='SCENARIO GUIDE'){const i=Math.max(0,Math.min(3,index)),item=walkthroughs[scenario][i];guideIndex=i;
    $('#stepNumber').textContent=`STEP 0${i+1} / 04`;$('#stepWhere').textContent=where;
    $('#stepTitle').textContent=item[0];$('#stepText').textContent=item[1];$('#guideStep').textContent=`${i+1} OF 4`;
    $('#stepProgress').style.width=`${(i+1)*25}%`;$('#backStep').disabled=i===0;$('#nextStep').disabled=i===3;
    document.querySelector('.stepPanel').dataset.step=String(i+1);
    window.packetLabState={scenario,index:i};
    window.dispatchEvent(new CustomEvent('walkthrough-step',{detail:{scenario,index:i}}));
  }
  $('#backStep').addEventListener('click',()=>showStep(guideIndex-1));$('#nextStep').addEventListener('click',()=>showStep(guideIndex+1));
  function send(data){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data))}
  function setScenario(kind){if(running||!scenarios[kind])return;scenario=kind;const item=scenarios[kind];
    cards.forEach(card=>card.classList.toggle('active',card.dataset.kind===kind));
    $('#attackKicker').textContent='WHAT HAPPENS';$('#attackName').textContent=item.title;
    $('#attackText').textContent=item.detail;$('#analogy').textContent=item.tip;
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
    window.dispatchEvent(new CustomEvent('packet-event',{detail:e}));
    if(comparison){if(e.type==='blocked')comparison.current.blocked++;if(e.type==='packet'&&e.packet_kind!=='normal')comparison.current.reached++;if(e.type==='status')comparison.current.load=e.load;}
    if(e.type==='tick')showStep(0,'TRAFFIC CREATED');
    if(e.type==='packet'||e.type==='blocked'){
      showStep(e.blocked?2:1,e.blocked?'STOPPED BY DEFENSE':`${(e.destination||'router').toUpperCase()} · MOVING`);
      eventCount++;$('#packetCount').textContent=eventCount;
      if(e.blocked){blocked++;$('#threatValue').textContent='BLOCKED';addLog(`Defense active: ${e.message.split(' blocked ')[0]} blocked this packet.`,'good')}
      else if(e.packet_kind!=='normal'){passed++;$('#threatValue').textContent='REACHED SERVICE';
        const msg=e.packet_kind==='dns_spoof'?'Forged address reply reached the DNS service.':
          e.packet_kind==='mitm'?'Intercepted message was not blocked.':'Unexpected request reached the web service.';
        addLog(msg,'bad')
      }else addLog('Expected traffic passed through the network.','good');
    }
    if(e.type==='status'){setLoad(e.load);showStep(3,`SERVICE LOAD ${String(e.load).padStart(2,'0')} / 100`)}
    if(e.type==='reset'){setLoad(8);$('#threatValue').textContent='READY'}
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
  function stop(){running=false;clearTimeout(timer);cards.forEach(c=>c.disabled=false);toggles.forEach(t=>t.disabled=false);$('#compare').disabled=false;button.textContent='▶ RUN SIMULATION';if(comparison){comparison.toggle.checked=comparison.original;send({action:'defense',kind:comparison.key,enabled:comparison.original});comparison=null}}
  function summarize(result){return {outcome:result.blocked?'BLOCKED':result.reached?'REACHED SERVICE':'PASSED',detail:`${result.blocked} stopped · ${result.reached} reached · load ${result.load}/100`}}
  function finishComparison(){const off=summarize(comparison.off),on=summarize(comparison.on),key=comparison.key,toggle=comparison.toggle,original=comparison.original;$('#compareOff').textContent=off.outcome;$('#compareOffDetail').textContent=off.detail;$('#compareOn').textContent=on.outcome;$('#compareOnDetail').textContent=on.detail;$('#compareTitle').textContent=`${defenseNames[key]} · ${scenarios[scenario].label}`;comparison=null;toggle.checked=original;send({action:'defense',kind:key,enabled:original});stop();$('#threatValue').textContent=on.outcome;addLog(`Comparison complete: ${defenseNames[key]} on versus off.`,'good')}
  function step(){if(!running)return;if(ticksLeft<=0){if(comparison&&comparison.phase==='off'){comparison.off=comparison.current;comparison.phase='on';comparison.current={blocked:0,reached:0,load:8};comparison.toggle.checked=true;send({action:'defense',kind:comparison.key,enabled:true});send({action:'select',kind:scenario});$('#compareOff').textContent=summarize(comparison.off).outcome;$('#compareOffDetail').textContent=summarize(comparison.off).detail;$('#compareOn').textContent='RUNNING';$('#compareOnDetail').textContent='Defense on; replaying the same scenario.';$('#compareTitle').textContent=`${defenseNames[comparison.key]} · second run`;ticksLeft=5;showStep(0,'RUN 2 · DEFENSE ON');timer=setTimeout(step,420);return}if(comparison&&comparison.phase==='on'){comparison.on=comparison.current;finishComparison();return}stop();$('#threatValue').textContent=blocked>0&&passed===0?'BLOCKED':passed>0?'REACHED SERVICE':'COMPLETE';addLog('Simulation complete. Select another defense to compare.','good');return}
    send({action:'tick'});ticksLeft--;timer=setTimeout(step,950)}
  button.addEventListener('click',()=>{if(running){stop();return}running=true;ticksLeft=5;blocked=0;passed=0;eventCount=0;showStep(0,'TRAFFIC CREATED');
    $('#packetCount').textContent='0';$('#threatValue').textContent='RUNNING';
    cards.forEach(c=>c.disabled=true);toggles.forEach(t=>t.disabled=true);button.textContent='Ⅱ PAUSE';
    addLog(`Running: ${scenarios[scenario].label}.`,'good');step()});
  $('#compare').addEventListener('click',()=>{if(running)return;const key=counterDefense[scenario],toggle=toggles.find(t=>t.dataset.defense===key);comparison={key,toggle,original:toggle.checked,phase:'off',current:{blocked:0,reached:0,load:8}};$('#comparePanel').hidden=false;$('#compareTitle').textContent=`${defenseNames[key]} · first run`;$('#compareOff').textContent='RUNNING';$('#compareOffDetail').textContent='Defense off; simulating this incident.';$('#compareOn').textContent='WAITING';$('#compareOnDetail').textContent='The same incident will run again with it on.';running=true;ticksLeft=5;toggle.checked=false;cards.forEach(c=>c.disabled=true);toggles.forEach(t=>t.disabled=true);$('#compare').disabled=true;button.textContent='COMPARING…';$('#threatValue').textContent='COMPARING';send({action:'defense',kind:key,enabled:false});send({action:'select',kind:scenario});showStep(0,'RUN 1 · DEFENSE OFF');step()});
  $('#reset').addEventListener('click',()=>{stop();eventCount=0;blocked=0;passed=0;$('#packetCount').textContent='0';$('#logItems').replaceChildren();
    send({action:'reset'});for(const t of toggles)send({action:'defense',kind:t.dataset.defense,enabled:t.checked});send({action:'select',kind:scenario});
    $('#threatValue').textContent='READY';setLoad(8);addLog('Simulation reset.','good')});
  $('#concepts').addEventListener('click',()=>$('#modal').classList.add('open'));
  $('#close').addEventListener('click',()=>$('#modal').classList.remove('open'));
  $('#modal').addEventListener('click',e=>{if(e.target.id==='modal')e.currentTarget.classList.remove('open')});

  // The no-WebGL topology remains draggable and zoomable.
  const map=$('#fallbackScene'),svg=map.querySelector('svg');let down=null,rx=-9,ry=-13,scale=1;
  function applyView(){svg.style.transform=`perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`}
  map.addEventListener('pointerdown',e=>{if(e.target.closest('.fbnode'))return;down={x:e.clientX,y:e.clientY,rx,ry};map.setPointerCapture?.(e.pointerId)});
  map.addEventListener('pointermove',e=>{if(down){ry=Math.max(-34,Math.min(34,down.ry+(e.clientX-down.x)*.055));rx=Math.max(-25,Math.min(18,down.rx-(e.clientY-down.y)*.04));applyView()}});
  const nodeHelp={ROUTER:'ROUTER · A traffic director that forwards data toward the right network or service.',CLIENT:'CLIENT · Your computer or phone. It asks network services for pages and information.','BOT CLIENTS':'BOT CLIENTS · Infected devices that create the simulated rush of requests.','WEB SERVER':'WEB SERVER · A computer that stores a site and sends its pages back.','DNS SERVER':'DNS SERVER · The internet’s address book; it finds the numeric address for a site name.'};
  map.querySelectorAll('.fbnode').forEach(node=>{node.addEventListener('pointerenter',e=>{const tip=$('#deviceTip');tip.textContent=nodeHelp[node.querySelector('.label')?.textContent]||'Network device';tip.style.left=`${Math.min(innerWidth-330,e.clientX+14)}px`;tip.style.top=`${Math.min(innerHeight-80,e.clientY+14)}px`;tip.classList.add('visible')});node.addEventListener('pointerleave',()=>$('#deviceTip').classList.remove('visible'))});
  map.addEventListener('pointerup',()=>down=null);map.addEventListener('pointercancel',()=>down=null);
  map.addEventListener('wheel',e=>{e.preventDefault();scale=Math.max(.78,Math.min(1.24,scale-e.deltaY*.00045));applyView()},{passive:false});
  map.querySelectorAll('.fbnode').forEach(node=>node.addEventListener('click',()=>{if(down)return;const name=node.querySelector('.label')?.textContent||'Network device';const toast=$('#toast');toast.textContent=`${name}: ${({ROUTER:'Forwards packets between networks.',CLIENT:'Sends requests to services.','BOT CLIENTS':'Creates the simulated attack traffic.','WEB SERVER':'Receives and responds to web requests.','DNS SERVER':'Resolves domain names to addresses.'})[name]||'A node in this simulated network.'}`;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2300)}));
  showStep(0);connect();
})();
