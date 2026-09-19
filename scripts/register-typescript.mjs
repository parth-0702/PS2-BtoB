import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
registerHooks({
  resolve(specifier,context,next){
    if(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)){
      const url=new URL(specifier+'.ts',context.parentURL);
      if(existsSync(fileURLToPath(url)))return next(url.href,context);
    }
    return next(specifier,context);
  },
  load(url,context,next){
    if(url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8')),shortCircuit:true};
    return next(url,context);
  }
});
