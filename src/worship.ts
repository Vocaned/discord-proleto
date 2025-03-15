import { SUBDIVISIONS } from './subdivisions';

let random = (seed: number): number => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

export let worship = async (date: string, channel: string, token: string): Promise<string> => {
    // Remove leading zeroes to get YYYYMD for legacy purposes
    let seed = parseInt(
        date.split('-').map(component => parseInt(component).toString()).join('')
    );

    let subdivision = SUBDIVISIONS[Math.floor(random(seed) * SUBDIVISIONS.length)];
    let country = subdivision.parent.toLowerCase().split('-')[0];

    let req = await fetch(`https://discord.com/api/v10/channels/${channel}`, {
        method: 'PATCH',
        body: JSON.stringify({
            name: `${subdivision.name}-worshipping`,
            topic: `:flag_${country}:`.repeat(3)
        }),
        headers: {
            Authorization: 'Bot ' + token,
            'Content-Type': 'application/json'
        }
    });

    let res = await req.text();
    if (req.status !== 200) throw new Error(res);
    return res;
}
