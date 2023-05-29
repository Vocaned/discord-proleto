import { COUNTRIES } from './countries';

interface Env {
    DISCORD_TOKEN: string;
    WORSHIP_CHANNEL_ID: string;
}

const random = (seed: number): number => {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

const worship = async (env: Env): Promise<string> => {
    const d = new Date();
    let seed = parseInt(
      `${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}`
    );
    let country = COUNTRIES[Math.floor(random(seed) * COUNTRIES.length)];

    let req = await fetch(`https://discord.com/api/v10/channels/${env.WORSHIP_CHANNEL_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({
            name: `${country.name}-worshipping`,
            topic: `:flag_${country.alpha2Code.toLowerCase()}::flag_${country.alpha2Code.toLowerCase()}::flag_${country.alpha2Code.toLowerCase()}:`
        })
    });

    let res = await req.text()

    if (req.status !== 200) throw res;
    return res;
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        ctx.waitUntil(worship(env));
    },
};