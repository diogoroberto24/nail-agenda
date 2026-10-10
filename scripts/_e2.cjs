const fs = require("fs");
let src = fs.readFileSync("scripts/_e.cjs", "utf8");
// ajusta o padrão da segunda substituição ao arquivo real
src = src.replace(`rep('await db.exec(readFileSync(MIG + "20261010000002_cadastro_convite.sql", "utf8"));\n\n',
    'await db.exec(readFileSync(MIG + "20261010000002_cadastro_convite.sql", "utf8"));\nawait db.exec(readFileSync(MIG + "20261011000001_aniversario_clientes.sql", "utf8"));\n\n');`,
`rep('await db.exec(readFileSync(MIG + "20261010000002_cadastro_convite.sql", "utf8"));\nrecord("migrações',
    'await db.exec(readFileSync(MIG + "20261010000002_cadastro_convite.sql", "utf8"));\nawait db.exec(readFileSync(MIG + "20261011000001_aniversario_clientes.sql", "utf8"));\nrecord("migrações');`);
fs.writeFileSync("scripts/_e.cjs", src);
