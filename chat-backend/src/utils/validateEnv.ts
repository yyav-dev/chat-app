const requireEnv = [
    "DATABASE_URL",
    "JWT_SECRET"
];

for (const variable of requireEnv){
    if(!process.env[variable]){
        throw new Error(`Missing environment variable: ${variable}`);
    }
}