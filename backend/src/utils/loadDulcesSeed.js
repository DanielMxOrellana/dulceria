const fs = require("fs");
const path = require("path");

function loadDulcesSeed() {
  const productosPath = path.resolve(__dirname, "../../../src/data/productos.js");
  const fileContent = fs.readFileSync(productosPath, "utf8");

  const match = fileContent.match(/export const dulces\s*=\s*(\[[\s\S]*?\]);/);
  if (!match || !match[1]) {
    throw new Error("No se pudo leer la lista de dulces desde src/data/productos.js");
  }

  const dulces = Function(`"use strict"; return (${match[1]});`)();
  if (!Array.isArray(dulces)) {
    throw new Error("Formato invalido de lista de dulces");
  }

  return dulces.map((dulce) => ({
    id: Number(dulce.id),
    nombre: String(dulce.nombre || ""),
    precio: Number(dulce.precio || 0),
    cantidad: Number.isFinite(Number(dulce.cantidad)) ? Number(dulce.cantidad) : 100,
    disponible: Boolean(dulce.disponible),
  }));
}

module.exports = { loadDulcesSeed };
