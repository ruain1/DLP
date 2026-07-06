// REV134: Registration Form For Energisation as a vector PDF. jsPDF and the autotable
// plugin are imported dynamically, so they stay out of the initial bundle and only load
// when someone actually composes an RFFE. The form is fixed except the location list,
// which is the asset or assets carried by the Yellow Tag event.

const CONTACT = { company: "CSN", person: "Damian Chlebek", phone: "+48 695 036 660", email: "damian.c@cs-nordics.com" };

async function makeDoc(assets) {
  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");                    // side effect: adds jsPDF.prototype.autoTable
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 48;
  let y = 54;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120);
  doc.text("++    Registration form for energisation", M, y); y += 26;
  doc.setFontSize(22); doc.setTextColor(20);
  doc.text("Registration form for energisation", M, y); y += 20;

  doc.setFontSize(9.5); doc.setTextColor(60);
  const intro = doc.splitTextToSize("To be able to plan energizing work as effective as possible we need the following input at least 48 hours prior to expected request. This to be able to put it into a plan and make a priority list together with CTS.", 500);
  doc.text(intro, M, y); y += intro.length * 12 + 10;

  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(20);
  doc.text("Requested inputs", M, y); y += 6;
  doc.setFont("helvetica", "normal");

  const loc = (assets || []).map((a) => a.tag).join("\n");
  doc.autoTable({
    startY: y + 8,
    margin: { left: M, right: M },
    head: [["No.", "Description:", "Answer by applicant:"]],
    body: [
      ["1", "Company name:", CONTACT.company],
      ["2", "Contact person:\nPhone no.:\nEmail:", CONTACT.person + "\n" + CONTACT.phone + "\n" + CONTACT.email],
      ["3", "At what location will the work take place?", loc],
      ["4", "Description of the work.", "Energise the listed asset(s) to enable L3 startup"],
      ["5", "How many workers will be attending?", "2 person from Velox 2 person from CSN 2 person from CTS"],
      ["6", "Do you need SAP/AP services?", "yes"],
      ["7", "How many hours is expected to be used?", "Expecting to use 2h for these tasks"],
    ],
    styles: { fontSize: 9, cellPadding: 5, valign: "top", lineColor: [150, 150, 150], lineWidth: 0.5, textColor: [20, 20, 20] },
    headStyles: { fillColor: [207, 207, 207], textColor: [20, 20, 20], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 28, halign: "center", fontStyle: "bold" }, 1: { cellWidth: 190 }, 2: { cellWidth: "auto" } },
    theme: "grid",
  });
  y = doc.lastAutoTable.finalY + 22;

  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(20);
  doc.text("Important for all applicants.", M, y); y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const bullets = [
    "SJA must be attached together with this form.",
    "Progress must be reported every day to be able to keep the plan up to date.",
    "If a vendor does not show to planned time, this will be looked at as a no-show, and timeslot will be given to next in line. Costs regarding this will be invoiced to vendor.",
    "All documentation needs to be available when this form is submitted. Declaration of conformity on product, checklists, FDV, etc.",
  ];
  bullets.forEach((b) => { const lines = doc.splitTextToSize(b, 470); doc.text("-", M, y); doc.text(lines, M + 12, y); y += lines.length * 12 + 4; });

  y += 12;
  doc.setFont("helvetica", "bold"); doc.text("This form shall be sent the following addresses:", M, y); y += 13;
  doc.setFont("helvetica", "normal"); doc.setTextColor(11, 87, 208);
  doc.text("sap.vantaa@veloxelectro-nordics.com", M, y);
  return doc;
}

export async function buildRffePdf(assets, filename) {
  const doc = await makeDoc(assets);
  const uri = doc.output("datauristring");           // data:application/pdf;filename=...;base64,XXXX
  return { name: filename, contentType: "application/pdf", contentBytes: uri.substring(uri.indexOf(",") + 1) };
}

export async function downloadRffePdf(assets, filename) {
  const doc = await makeDoc(assets);
  doc.save(filename);
}
