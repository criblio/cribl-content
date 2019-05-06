const { Expression } = C.expr;
const cLogger = C.util.getLogger('func:jquery_eval');

const { JSDOM } = require('jsdom');
const fs = require('fs');

exports.name = 'JQuery Eval';
exports.version = '0.1';
exports.disabled = false;
exports.group = 'Demo Functions';

let fields2add = []; // key1, expr1, key2, expr2 ...

const CTRL_PREFIX = '_ctrl.';
let conf;
exports.init = (opts) => {
  conf = opts.conf;
  fields2add = [];

  const add = [];
  (conf.add || []).forEach(field => {
    field.name = (field.name || '').trim();
    const isCtrlField = field.name.startsWith(CTRL_PREFIX);
    add.push(isCtrlField);
    add.push(isCtrlField ? field.name.substr(CTRL_PREFIX.length) : field.name);
    add.push(new Expression(`${field.value}`, { disallowAssign: true }));
  });

  fields2add = add;
};


exports.process = (event) => {
  // add/replace some fields
  for (let i = 2; i < fields2add.length; i += 3) {
    const dom = new JSDOM(event[conf.htmlField]);
    event.$ = (require('jquery'))(dom.window);

    const key = fields2add[i - 1];
    const val = fields2add[i].evalOn(event);

    delete event.$;

    if (!fields2add[i - 2]) {
      if (key) { // might need to throw away the result
        event[key] = val;
      }
    } else {
      event.setCtrlField(key, val);
    }
  }
  return event;
};
