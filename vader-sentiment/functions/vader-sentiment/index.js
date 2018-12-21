const cLogger = C.util.getLogger('func:sentient');

exports.name = 'Vader-Sentiment';
exports.version = '0.1';
//exports.group = 'NLTK';
exports.group = 'Extreme Vigilance RealTime';

const vader = require ('vader-sentiment');

var _inputFieldName = '';
var _outputFieldName = '';

exports.init = (opts) => {
   const conf = opts.conf || {};
   _inputFieldName = (conf.inputField || '').trim();
   _outputFieldName = (conf.outputField || '').trim();
   cLogger.info ("Sentiment initialized, input field: " + _inputFieldName + ", output field: " + _outputFieldName);

};

exports.process = (event) => {

    try {
        var intensity = 0.0;
        const text = event [_inputFieldName];
        cLogger.debug ("Running sentiment against input field: [" + _inputFieldName + "], text: [" + text + "]");
        if (text.length > 0) {
            const result = vader.SentimentIntensityAnalyzer.polarity_scores (text);
            intensity = result.compound;
        }
        cLogger.debug ("Adding sentiment to output field: [" + _outputFieldName + "], score: (" + intensity + ")");
        event [_outputFieldName] = intensity;
    }
    catch (ignore) {}

   return event;
};
