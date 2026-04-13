//import math from "./math.js"
import log from "loglevel";

function getValue( context: any, path: string, depth:number = 0 ): string {
    if( depth > 10 ) {
        log.error('Template recursing too deeply:', path, JSON.stringify(context) );
        throw new Error('Template recursing too deeply: ' + path);
    }

    const result = path.split('.').reduce((o, k) => (o || {})[k], context);
    if( result && result.indexOf('${') > -1 )
        return replacePlaceholders({ template: result, context, depth });   // recurse
    else
        return result;
}

const regex = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/;
function isDottedVariableName(s:string) {
    return regex.test(s);
}

interface ReplaceParams {
	template: string,
	context: any,
	scopes?: string[],
	depth?: number
}

export function replacePlaceholders({template, context, scopes = ['','exports.'], depth = 0}: ReplaceParams): string {
    if ( !template || Object.keys(context).length === 0)
        return template;

    return template.replace(/(\${([^}]+)})/g, (match) => {
        let placeholder = match.replace(/\${/, '').replace(/}/, '').trim();

        if( isDottedVariableName( placeholder ) ) {
            for( let prefix of scopes ) {
                const result = getValue( context, prefix + placeholder, depth + 1 );
                if( result )
                    return result;
            }
        } /*else {
            // a math equation
            const result = math( placeholder, context.exports );
            return result;
        }*/

        log.warn( 'Failed to find value for placeholder', placeholder, context );
        return '';
    });
}
