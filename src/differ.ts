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
        oldContent = JSON.stringify(JSON.parse(old), null, 2).split('\n').map(l => l.trim());
        newContent = JSON.stringify(JSON.parse(content), null, 2).split('\n').map(l => l.trim());
    } else if (differ.type === 'text') {
        oldContent = old.split('\n');
        newContent = content.split('\n');
    } else {
        throw new Error(`Unknown parser ${differ.type}`);
    }

    let added = newContent.filter(l => !oldContent.includes(l));
    let removed = oldContent.filter(l => !newContent.includes(l));

    let output = '';
    for (let l of added) {
        output += `+ ${l}\n`;
    }
    for (let l of removed) {
        output += `- ${l}\n`;
    }

    if (output) {
        output = output.substring(0, 4080);

        await fetch(differ.webhook, {
            method: 'POST',
            body: JSON.stringify({
                embeds: [{
                    title: `${differ.id}`,
                    description: '```diff\n' + output + '```',
                    url: differ.fetch_url,
                    timestamp: new Date().toISOString()
                }]
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    return content;
}
