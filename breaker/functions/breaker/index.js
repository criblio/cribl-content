exports.name = 'Event Breaker';
exports.version = '0.1';
exports.group = 'Demo Functions';

const { NamedGroupRegExp } = C.util; 
const { NestedPropertyAccessor } = C.expr;

let regex;
let field;
let iterations;
exports.init = (opts) => {
  const conf = opts.conf || {};
  regex = null;
  
  if (conf.regex) {
    conf.regex = conf.regex.trim();
    const result = NamedGroupRegExp.parseRegexLiteral(conf.regex);
    if(result.groups.length !== 2)
      throw new Error('regex must have one capturing group');
    // force global flag
    if(!(result.flags || '').includes('g'))
      conf.regex = `${conf.regex}g`;
    regex = new NamedGroupRegExp(conf.regex);
  } else {
    throw new Error('missing required parameter: regex');
  }
  field = new NestedPropertyAccessor(conf.field || '_raw');
  iterations = Number(conf.iterations) || 100;
};


exports.process = (event) => {
  if(!regex) return event;
  regex.lastIndex = 0;

  const fieldVal = field.get(event);
  if (!fieldVal) {
    return event;
  }
  const result = [];
  
  for(let i=0; i<iterations; i++) {
    const m = regex.exec(fieldVal);
    if(!m) break;
    const ne = event.clone();
    field.set(ne, m[1]);
    result.push(ne);
  } 
  return result.length ? result : event;
}

