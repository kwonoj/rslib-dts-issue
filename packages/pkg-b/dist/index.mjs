import { VERSION, helloFromA } from "pkg-a";
function helloFromB() {
    return `${helloFromA()} and Hello from package B (version: ${VERSION})`;
}
function createUser(id, name) {
    return {
        id,
        name
    };
}
function createConfig() {
    return {
        apiUrl: 'https://api.example.com',
        timeout: 5000
    };
}
export { createConfig, createUser, helloFromB };
