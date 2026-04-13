export function extractJson( text: string ) {
    const jsonObjects = [];
    let textWithoutJson = '';
    let i = 0;

    while (i < text.length) {
        if (text[i] === '{') {
            let start = i;
            let depth = 0;
            let inString = false;
            let escapeNext = false;

            while (i < text.length) {
                const char = text[i];

                if (escapeNext) {
                    escapeNext = false;
                } else if (char === '\\') {
                    escapeNext = true;
                } else if (char === '"') {
                    inString = !inString;
                } else if (!inString) {
                    if (char === '{') depth++;
                    else if (char === '}') depth--;

                    if (depth === 0) {
                        const candidate = text.slice(start, i + 1);
                        try {
                            const parsed = JSON.parse(candidate);
                            jsonObjects.push(parsed);
                            text = text.slice(0, start) + text.slice(i + 1); // Remove JSON from original text
                            i = start; // Reset position to continue scanning
                        } catch (e) {
                            // Not valid JSON; treat as normal text
                            i = start + 1;
                        }
                        break;
                    }
                }

                i++;
            }

            // If we exit loop without breaking, it's malformed
            if (depth !== 0) {
                textWithoutJson += text[start];
                i = start + 1;
            }
        } else {
            textWithoutJson += text[i];
            i++;
        }
    }

    // Include remaining text (after the last match)
    textWithoutJson += text.slice(i);

    // clean up common JSON wrapper
    textWithoutJson = textWithoutJson.replace(/\s*```json\s*```/g,'').trim();

    return {
        jsonObjects,
        textWithoutJson
    };
}
