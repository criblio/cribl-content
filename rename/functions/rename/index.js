const cLogger = C.util.getLogger('func:rename');

exports.name = 'Rename';
exports.version = '0.1';
exports.group = 'Demo Functions';

let _renameFields = [];

exports.init = (opts) => {
  conf = opts.conf || {};

  if (!conf.fields || conf.fields.length < 1) {
     cLogger.error ("Invalid arguments - Must specify at least 1 field to rename!", { conf });
     return;
  }

  cLogger.debug ("Config has: " + conf.fields.length + " fields to rename");

  for (var i = 0; i < conf.fields.length; i++)
  {
    let field = conf.fields[i]; 
    let fieldName = field['fieldName'];
    let renameTo = field['renameTo'];
    _renameFields.push ([fieldName,renameTo]); 
    cLogger.info ("Added rename field: " + fieldName + " => " + renameTo);
  }

  cLogger.info ("Loaded Rename fields: " + _renameFields);
};

exports.unload = () => {
};

exports.process = (event) => {

  //cLogger.debug ("Received event: " + JSON.stringify (event));

  if (event)
  {
      for (let i = 0; i < _renameFields.length; i++) {

          let fieldName = _renameFields[i][0];
          let renameTo = _renameFields[i][1];

          //cLogger.debug ("Renaming field: " + fieldName + " => " + renameTo);

          if (fieldName && renameTo && event.hasOwnProperty (fieldName)) {

             let value = event [fieldName];
             delete event [fieldName];
             event [renameTo] = value;

             //cLogger.debug ("Event Has field: " + fieldName + ", renamed to: " + renameTo);
          }
      }
  }

  return event;
};
