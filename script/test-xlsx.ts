
import * as XLSX from "xlsx";
import * as fs from "fs";

const wb = XLSX.utils.book_new();
const wsData = [
    ["Header"],
    [123], // Row 2
];
const ws = XLSX.utils.aoa_to_sheet(wsData);

// Extend range
const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
range.e.r = 10;
ws["!ref"] = XLSX.utils.encode_range(range);

// Row 3: Stub cell with format (Current approach)
ws["A3"] = { t: 'z', v: "", z: "0.00" };

// Row 4: Numeric cell with null value
ws["A4"] = { t: 'n', v: null, z: "0.00" };

// Row 7: String cell with space
ws["A7"] = { t: 's', v: " ", z: "0.00" };

// Row 5: Numeric cell with undefined value
ws["A5"] = { t: 'n', z: "0.00" }; // v undefined

// Row 6: String cell with empty string
ws["A6"] = { t: 's', v: "", z: "0.00" }; // z ignored for strings?

XLSX.utils.book_append_sheet(wb, ws, "Test");
XLSX.writeFile(wb, "test.xlsx");

console.log("Written test.xlsx");

console.log("Written test.xlsx");

const buf = fs.readFileSync("test.xlsx");
const wb2 = XLSX.read(buf, { type: "buffer" });
const ws2 = wb2.Sheets["Test"];
console.log("A3:", ws2["A3"]);
console.log("A4:", ws2["A4"]);
console.log("A5:", ws2["A5"]);
console.log("A6:", ws2["A6"]);
console.log("A7:", ws2["A7"]);
