type Parser = 'json' | 'text';

export interface Differ {
    id: string,
    fetch_url: string,
    fetch_opts: RequestInit<RequestInitCfProperties>,
    type: Parser,
    webhook: string
}

export let diff = async (differ: Differ, old: string): Promise<string> => {
    let req = await fetch(differ.fetch_url, differ.fetch_opts);
    let content = await req.text();

    let oldContent: string[] = [];
    let newContent: string[] = [];

    if (differ.type === 'json') {
        if (!old) old = '{}';
        // Format JSON
        oldContent = JSON.stringify(JSON.parse(old), null, 2).split('\n');
        newContent = JSON.stringify(JSON.parse(content), null, 2).split('\n');
    } else if (differ.type === 'text') {
        oldContent = old.split('\n');
        newContent = content.split('\n');
    } else {
        throw new Error(`Unknown parser ${differ.type}`);
    }

    let added: string[] = [];
    let modified: string[][] = [];
    let removed: string[] = [];

    let maxLength = Math.max(oldContent.length, newContent.length);
    for (let i = 0; i < maxLength; i++) {
        let oldLine = (oldContent[i] ?? '').trim();
        let newLine = (newContent[i] ?? '').trim();

        if (oldLine === newLine) continue;

        if (newLine && !oldLine) added.push(newLine);
        else if (!newLine && oldLine) removed.push(oldLine);
        else modified.push([oldLine, newLine])
    }

    let output = '';
    if (added.length > 0) {
        output += '## Added\n```diff\n';
        for (let l of added) {
            output += `+ ${l}\n`;
        }
        output += '```\n';
    }
    if (modified.length > 0) {
        output += '## Modified\n```diff\n';
        for (let m of modified) {
            output += `- ${m[0]}\n+ ${m[1]}\n`;
        }
        output += '```\n';
    }
    if (removed.length > 0) {
        output += '## Removed\n```diff\n';
        for (let l of removed) {
            output += `- ${l}\n`;
        }
        output += '```\n';
    }

    if (output) {
        await fetch(differ.webhook, {
            method: 'POST',
            body: JSON.stringify({
                embeds: [{
                    title: `${differ.id}`,
                    description: output.substring(0, 4090),
                    url: differ.fetch_url
                }]
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    return content;
}
