const stateContainer = document.querySelector('.state-container');

let audioContext;
let source;
let distortion;
let highpass;

const store = new Proxy({
  mode: '',
  initialized: false,
}, {
  set: function(target, key, value) {
    const oldMode = target.mode;
    target[key] = value;
    updateDom();
    updateAudio(source, audioContext, target.mode, oldMode);
  },
  get: function(target, key) {
    return target[key];
  },
});

const effects = {
  mute: {
    label: 'MUTE',
    set: function(source, audioContext) {},
    clear: function(source, audioContext) {},
  },
  bypass: {
    label: 'BYPASS',
    set: function(source, audioContext) {
      source.connect(audioContext.destination);
    },
    clear: function(source, audioContext) {
      source.disconnect();
    },
  },
  distortion: {
    label: 'DISTORTION',
    set: function(source, audioContext) {
      // ディストーションだけ
      // source.connect(distortion);
      // distortion.connect(audioContext.destination);
      // ハイパスしてディストーション
      source.connect(highpass);
      highpass.connect(distortion);
      distortion.connect(audioContext.destination);
    },
    clear: function(source, audioContext) {
      source.disconnect();
      highpass.disconnect();
      distortion.disconnect();
    },
  },
};

document.querySelector('.button-mute').addEventListener('click', async function() {await initIfNotDone();store.mode = 'mute';});
document.querySelector('.button-bypass').addEventListener('click', async function() {await initIfNotDone();store.mode = 'bypass';});
document.querySelector('.button-distortion').addEventListener('click', async function() {await initIfNotDone();store.mode = 'distortion';});

async function initIfNotDone() {
  return new Promise(async function(resolve, reject) {
    if (!store.initialized) {
      await init();
      store.initialized = true;
    }
    resolve();
  });
}

async function init() {
  return new Promise(function(resolve, reject) {
    if (navigator.mediaDevices === undefined) {
      navigator.mediaDevices = {};
    }
    if (navigator.mediaDevices.getUserMedia === undefined) {
      navigator.mediaDevices.getUserMedia = function(constraints) {
        var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        if (!getUserMedia) {
          return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
        }
        return new Promise(function(resolve, reject) {
          getUserMedia.call(navigator, constraints, resolve, reject);
        });
      }
    }
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    distortion = audioContext.createWaveShaper();
    distortion.curve = makeDistortionCurve(200);
    // distortion.oversample = '4x';
    highpass = audioContext.createBiquadFilter();
    highpass.type = (typeof highpass.type === 'string') ? 'highpass' : 1;
    highpass.frequency.value = 400;
    if (navigator.mediaDevices.getUserMedia) {
      console.log('getUserMedia supported.');
      // var constraints = {audio: true};
      var constraints = {
        audio: {
          echoCancellation: false,
        },
      };
      navigator.mediaDevices.getUserMedia(constraints)
        .then(
          function(stream) {
            source = audioContext.createMediaStreamSource(stream);
            resolve();
          }
        )
        .catch(
          function(err) {
            console.log('The following gUM error occured: ' + err);
            reject();
          }
        )
    } else {
      console.log('getUserMedia not supported on your browser!');
      reject();
    }
  });
}

function makeDistortionCurve(amount) {
  var k = typeof amount === 'number' ? amount : 50,
    n_samples = 44100,
    curve = new Float32Array(n_samples),
    deg = Math.PI / 180,
    i = 0,
    x;
  for ( ; i < n_samples; ++i ) {
    x = i * 2 / n_samples - 1;
    curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
  }
  return curve;
};

function updateDom() {
  stateContainer.innerHTML = effects[store.mode].label;
}

async function updateAudio(source, audioContext, newMode, oldMode) {
  if (store.initialized) {
    if (effects[oldMode]) effects[oldMode].clear(source, audioContext);
    effects[newMode].set(source, audioContext);
  }
}

store.mode = 'mute';
