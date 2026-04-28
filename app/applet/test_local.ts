import dotenv from 'dotenv';
dotenv.config();

const test = async () => {
    try {
        const response = await fetch("http://localhost:3000/api/cron/heartbeat?force=true", {
            headers: {
                "Authorization": `Bearer ${process.env.CRON_SECRET}`
            }
        });
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch(e) {
        console.error(e);
    }
}
test();
