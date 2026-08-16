import { Handler } from "@netlify/functions";

export const handler: Handler = async (event, context) => {
    const method = event.httpMethod

    if (method === "GET") {
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Pong" })
        }
    }

    return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Method Not Allowed" })
    }
}