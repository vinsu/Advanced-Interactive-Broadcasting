import AgoraRTC from 'agora-rtc-sdk';
import {Toast, addView, removeView} from './common';

console.log("agora sdk version: " + AgoraRTC.VERSION + " compatible: " + AgoraRTC.checkSystemRequirements());

export default class RTCClient {
  constructor () {
    this._client = null;
    this._joined = false;
    this._published = false;
    this._localStream = null;
    this._remoteStreams = [];
    this._params = {};

    this._showProfile = false;
  }

  handleEvents() {
    this._client.on("error", (err) => {
      console.log(err)
    })
    // Occurs when the peer user leaves the channel; for example, the peer user calls Client.leave.
    this._client.on("peer-leave", (evt) => {
      var id = evt.uid;
      if (id != this._params.uid) {
        removeView(id);
      }
      Toast.notice("peer leave")
      console.log('peer-leave', id);
    })
    // Occurs when the local stream is _published.
    this._client.on("stream-published", (evt) => {
      Toast.notice("stream published success")
      console.log("stream-published");
    })
    // Occurs when the remote stream is added.
    this._client.on("stream-added", (evt) => {  
      var remoteStream = evt.stream;
      var id = remoteStream.getId();
      Toast.info("stream-added uid: " + id)
      if (id !== this._params.uid) {
        this._client.subscribe(remoteStream, (err) => {
          console.log("stream subscribe failed", err);
        })
      }
      console.log('stream-added remote-uid: ', id);
    });
    // Occurs when a user subscribes to a remote stream.
    this._client.on("stream-subscribed", (evt) => {
      const remoteStream = evt.stream;
      const id = remoteStream.getId();
      this._remoteStreams.push(remoteStream);
      addView(id, this._showProfile);
      remoteStream.play("remote_video_" + id, {fit: "cover"});
      Toast.info('stream-subscribed remote-uid: ' + id);
      console.log('stream-subscribed remote-uid: ', id);
    })
    // Occurs when the remote stream is removed; for example, a peer user calls Client.unpublish.
    this._client.on("stream-removed", (evt) => {
      const remoteStream = evt.stream;
      const id = remoteStream.getId();
      Toast.info("stream-removed uid: " + id)
      remoteStream.stop("remote_video_" + id);
      this._remoteStreams = this._remoteStreams.filter((stream) => {
        return stream.getId() !== id
      })
      removeView(id);
      console.log('stream-removed remote-uid: ', id);
    })
    this._client.on("onTokenPrivilegeWillExpire", () => {
      // After requesting a new token
      // this._client.renewToken(token);
      Toast.info("onTokenPrivilegeWillExpire")
      console.log("onTokenPrivilegeWillExpire")
    });
    this._client.on("onTokenPrivilegeDidExpire", () => {
      // After requesting a new token
      // client.renewToken(token);
      Toast.info("onTokenPrivilegeDidExpire")
      console.log("onTokenPrivilegeDidExpire")
    })
    // Occurs when invoke client.addInjectStreamUrl success;
    this._client.on("streamInjectedStatus", function (evt) {
      Toast.info("streamInjectedStatus changed");
      // You could see streamInjectedStatus here.
      console.log(evt)
    })
  }

  join (data) {
    return new Promise((resolve, reject) => {
      if (this._client) {
        Toast.error("Your already create client");
        return;
      }
    
      if (this._joined) {
        Toast.error("Your already joined");
        return;
      }
    
      /**
       * A class defining the properties of the config parameter in the createClient method.
       * Note:
       *    Ensure that you do not leave mode and codec as empty.
       *    Ensure that you set these properties before calling Client.join.
       *  You could find more detail here. https://docs.agora.io/en/Video/API%20Reference/web/interfaces/agorartc.clientconfig.html
      **/
      this._client = AgoraRTC.createClient({mode: data.mode, codec: data.codec});
    
      this._params = data;
    
      // handle AgoraRTC client event
      this.handleEvents();
    
      // init client
      this._client.init(data.appID, () => {
        console.log("init success");
    
        // join client
        this._client.join(data.token ? data.token : null, data.channel, data.uid ? data.uid : null, (uid) => {
          this._params.uid = uid;
          Toast.notice("join channel: " + data.channel + " success, uid: " + uid);
          console.log("join channel: " + data.channel + " success, uid: " + uid);
          this._joined = true;
    
          
          // create local stream
          this._localStream = AgoraRTC.createStream({
            streamID: this._params.uid,
            audio: true,
            video: true,
            screen: false,
            microphoneId: data.microphoneId,
            cameraId: data.cameraId
          })
    
          // init local stream
          this._localStream.init(() => {
            console.log("init local stream success");
            // play stream with html element id "local_stream"
            this._localStream.play("local_stream", {fit: "cover"})
    
            // run callback
            resolve();
          }, (err) =>  {
            Toast.error("stream init failed, please open console see more detail")
            console.error("init local stream failed ", err);
          })
        }, function(err) {
          Toast.error("client join failed, please open console see more detail")
          console.error("client join failed", err)
        })
      }, (err) => {
        Toast.error("client init failed, please open console see more detail")
        console.error(err);
      });
    })
  }
  
  leave () {
    if (!this._client) {
      Toast.error("Please Join First!");
      return;
    }
    if (!this._joined) {
      Toast.error("You are not in channel");
      return;
    }
    // leave channel
    this._client.leave(() => {
      // close stream
      this._localStream.close();
      // stop stream
      this._localStream.stop();
      while (this._remoteStreams.length > 0) {
        const stream = this._remoteStreams.shift();
        const id = stream.getId()
        stream.stop();
        removeView(id);
      }
      this._localStream = null;
      this._remoteStreams = [];
      this._client = null;
      console.log("client leaves channel success");
      this._published = false;
      this._joined = false;
      Toast.notice("leave success")
    }, (err) => {
      console.log("channel leave failed");
      Toast.error("leave success")
      console.error(err);
    })
  }
  
  addRTMPInjectStream () {
    if (!this._client) {
      Toast.error("Please Join First!");
      return;
    }
    const injectStreamConfig = {
      width: 640,
      height: 480,
      videoGop: 30,
      videoFramerate: 30,
      videoBitrate: 500,
      audioSampleRate: 48000,
      audioBitrate: 50,
      audioChannels: 1,
    };
    
    this._client.addInjectStreamUrl(this._params.url, injectStreamConfig);
  }
    
  removeRTMPInjectStream () {
    if (!this._client) {
      Toast.error("Please Join First!");
      return;
    }
    this._client.removeInjectStreamUrl(this._params.url);
  }

  publish () {
    if (!this._client) {
      Toast.error("Please Join First");
      return;
    }
    if (this._published) {
      Toast.error("Your already published");
      return;
    }
    const oldState = this._published;
  
    // publish localStream
    this._client.publish(this._localStream, (err) => {
      this._published = oldState;
      console.log("publish failed");
      Toast.error("publish failed");
      console.error(err);
    })
    Toast.info("publish");
    this._published = true;
  }

  unpublish () {
    if (!this._client) {
      Toast.error("Please Join First");
      return;
    }
    if (!this._published) {
      Toast.error("Your didn't publish");
      return;
    }
    const oldState = this._published;
    this._client.unpublish(this._localStream, (err) => {
      this._published = oldState;
      console.log("unpublish failed");
      Toast.error("unpublish failed")
      console.error(err);
    });
    Toast.info("unpublish");
    this._published = false;
  }

  _getLostRate (lostPackets, arrivedPackets) {
    let lost = lostPackets ? +lostPackets : 0;
    let arrived = arrivedPackets ? +arrivedPackets : 0;
    if (arrived == 0) return 0;
    const result = (lost / (lost + arrived)).toFixed(2) * 100
    return result;
  }

  _updateVideoInfo () {
    this._localStream && this._localStream.getStats((stats) => {
      const localStreamProfile = [
        ['uid: ', this._localStream.getId()].join(''),
        ['accessDelay: ', stats.accessDelay, 'ms'].join(''),
        ['audioSendPacketsLost: ', this._getLostRate(stats.audioSendPacketsLost, stats.audioSendPackets), '%'].join(''),
        ['videoSendFrameRate: ', stats.videoSendFrameRate, 'fps'].join(''),
        ['videoSendPacketsLost: ', this._getLostRate(stats.videoSendPacketsLost, stats.videoSendPackets), '%'].join(''),
        ['resolution: ', stats.videoSendResolutionWidth + 'x' + stats.videoSendResolutionHeight].join(''),
      ].join('<br/>');
      $("#local_video_info")[0].innerHTML = localStreamProfile;
    })

    if (this._remoteStreams.length > 0) {
      for (let remoteStream of this._remoteStreams) {
        remoteStream.getStats((stats) => {
          const remoteStreamProfile = [
            ['uid: ', this._localStream.getId()].join(''),
            ['accessDelay: ', stats.accessDelay, 'ms'].join(''),
            ['endToEndDelay: ', stats.endToEndDelay, 'ms'].join(''),
            ['audioReceiveDelay: ', stats.audioReceiveDelay, 'ms'].join(''),
            ['audioReceivePacketsLost: ', this._getLostRate(stats.audioReceivePacketsLost, stats.audioReceivePackets), '%'].join(''),
            ['videoReceiveDecodeFrameRate: ', stats.videoReceiveDecodeFrameRate, 'fps'].join(''),
            ['videoReceiveDelay: ', stats.videoReceiveDelay, 'ms'].join(''),
            ['videoReceiveFrameRate: ', stats.videoReceiveFrameRate, 'fps'].join(''),
            ['videoReceivePacketsLost: ', this._getLostRate(stats.videoReceivePacketsLost, stats.videoReceivePackets), '%'].join(''),
            ['resolution: ', stats.videoReceiveResolutionWidth + 'x' + stats.videoReceiveResolutionHeight].join(''),
          ].join('<br/>');
          $("#remote_video_info_"+remoteStream.getId())[0].innerHTML = remoteStreamProfile;
        })
      }
    }
  }

  setNetworkQualityAndStreamStats (enable) {
    this._showProfile = enable;
    this._showProfile ? $(".video-profile").removeClass("hide") : $(".video-profile").addClass("hide")
    if (this._joined && !this._interval) {
      this._interval = setInterval(() => {
        this._updateVideoInfo()
      }, 2000);
    }
  }
}

