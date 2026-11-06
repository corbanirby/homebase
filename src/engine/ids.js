// One counter for every entity id in the world (creatures, plants, floating text).
let nextId = 1;
export function newId() { return nextId++; }
export function getNextId() { return nextId; }
export function setNextId(n) { nextId = Math.max(1, n | 0); }
