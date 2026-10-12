
export default class Entity {

    constructor() {

    }

    toJSON() {
        const json = {};
        const descritores = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(this));
        for (const [nome, descritor] of Object.entries(descritores)) {
            if (typeof descritor.get === "function") json[nome] = this[nome];
        }
        return json;
    }
}
