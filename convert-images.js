const fs = require("fs");
const path = require("path");

const productsDir = path.join(__dirname, "products");

const files = fs
  .readdirSync(productsDir)
  .filter(file => file.endsWith(".json"));

let changedFiles = 0;
let changedImages = 0;

for (const file of files) {

  const filePath =
    path.join(productsDir, file);

  const raw =
    fs.readFileSync(filePath, "utf8");

  const product =
    JSON.parse(raw);

  if (!Array.isArray(product.images)) {
    continue;
  }

  let changed = false;

  product.images =
    product.images.map(item => {

      if (typeof item === "string") {

        changed = true;
        changedImages++;

        return {
          image: item,
          ai_image: false
        };
      }

      return item;
    });

  if (changed) {

    fs.writeFileSync(
      filePath,
      JSON.stringify(product, null, 2) + "\n",
      "utf8"
    );

    changedFiles++;

    console.log(
      "Umgestellt:",
      file
    );
  }
}

console.log("");
console.log(
  `Fertig: ${changedFiles} Produktdateien und ${changedImages} Bilder wurden umgestellt.`
);
