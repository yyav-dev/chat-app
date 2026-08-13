import { Server } from "@hapi/hapi";

export const registerHealthRoute = (server: Server) =>{
    server.route({
        method: "GET",
        path: "/health",
        options: {
            auth: false,
        },
        handler: () =>{
            return{
                success: true,
                message: "Real-time Chat App",
                timestamp: new Date().toISOString(),
            };
        },
    });
};