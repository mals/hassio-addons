import "./jquery-3.4.1.min.js";
import "./adapter-latest.js";

class WebRTCCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.webrtc_config = {
      iceServers: [{
        urls: ["stun:stun.l.google.com:19302"]
      }]
    };

  }

  set hass(hass) {
    var stream = this.shadowRoot.getElementById(this.suuid + "_" + "video");
    if(stream && stream.paused) {
      stream.play();
      stream.muted = false
    }
    stream = this.shadowRoot.getElementById(this.suuid + "_" + "audio");
    if(stream && stream.paused) {
      stream.play();
      stream.muted = false
    }
  }

  getCardSize() {
    return 3;
  }

  setConfig(config) {
    this.config = config;
    if (!config.suuid) {
        throw new Error('You need to define a stream uuid');
    }
    if (!config.webrtc_host) {
        throw new Error('You need to define a webrtc_host');
    }

    this.suuid = config.suuid;
    this.webrtc_url_root = config.webrtc_host;

    const root = this.shadowRoot;

    if (root.lastChild) {
      root.removeChild(root.lastChild);
    }

    if (!this.content) {
      this.card = document.createElement('ha-card');
      this.content = document.createElement('div');
      this.content.setAttribute("id", "remoteVideo");

      const style = document.createElement('style');
      style.textContent = `
          ha-card {
            overflow: hidden;
            height: 100%;
            box-sizing: border-box;
          }
          #remoteVideo div {
              position: absolute;
              transform: translate(-50%, -50%);
          }
          `;


      this.card.appendChild(this.content);
      this.card.append(style);
      this.shadowRoot.appendChild(this.card);

    }

    if (!this.pc) {
      var myself = this;
      this.sendChannel = null;
      this.pc = new RTCPeerConnection(this.webrtc_config);
      this.pc.onnegotiationneeded = function() {
        myself.pc.createOffer().then(function(offer) {
          return myself.pc.setLocalDescription(offer);
        })
        .then(function() {
            // Send the offer to the remote peer through the signaling server
            myself.getRemoteSdp();
          });
        }
      this.startConnection();
    }

  }

  startConnection() {
    var myself = this;

    this.pc.ontrack = function(event) {
      console.log(event.streams.length + ' ' + event.track.kind + ' track was delivered')
      var el = document.createElement(event.track.kind)
      el.setAttribute("id", myself.suuid + "_" + event.track.kind);
      el.srcObject = event.streams[0]
      /*
      el.addEventListener('focus', (event1) => {
        console.log("focus event for " + el);
        el.play();
        el.muted = false;
      });
      el.addEventListener('blur', (event1) => {
        console.log("blur event for " + el);
        el.pause();
        el.muted = false;
      });
      */
      el.muted = true
      el.autoplay = true
      el.controls = true
      el.width = myself.card.offsetWidth
      el.style.display = "block"
      myself.content.appendChild(el)
    }

    $('#' + this.suuid).addClass('active');
    this.getCodecInfo();

  }


  getCodecInfo() {
    var myself = this;
    $.get(this.webrtc_url_root + "codec/" + this.suuid, function(data) {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.log(e);
      } finally {
        $.each(data,function(index,value){
          myself.pc.addTransceiver(value.Type, {
            'direction': 'sendrecv'
          })
        })
        //send ping becouse PION not handle RTCSessionDescription.close()
        myself.sendChannel = myself.pc.createDataChannel('foo');
        myself.sendChannel.onclose = () => console.log('sendChannel has closed');
        myself.sendChannel.onopen = () => {
          console.log('sendChannel has opened');
          myself.sendChannel.send('ping');
          setInterval(() => {
            myself.sendChannel.send('ping');
          }, 1000)
        }
        myself.sendChannel.onmessage = e => log(`Message from DataChannel '${sendChannel.label}' payload '${e.data}'`);
      }
    });
  }


  getRemoteSdp() {
    var myself = this;
    $.post(myself.webrtc_url_root + "recive", {
      suuid: myself.suuid,
      data: btoa(myself.pc.localDescription.sdp)
    }, function(data) {
      try {
        myself.pc.setRemoteDescription(new RTCSessionDescription({
          type: 'answer',
          sdp: atob(data)
        }))


      } catch (e) {
        console.log(e);
      }

    });
  }

}

customElements.define('lovelace-webrtc-card', WebRTCCard);

