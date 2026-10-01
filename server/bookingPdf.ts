import type { Express, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { getAdminByRequest } from "./adminAuth";
import { getBookingById } from "./db";

export const bookingStatusLabel = (status: string) => ({ requested: "Solicitado", confirmed: "Confirmado", refused: "Recusado", completed: "Concluído" }[status] || status);
const petSizeLabel = (size: string) => ({ small: "Pequeno", medium: "Médio", large: "Grande" }[size] || size);

function sendBookingPdf(res: Response, booking: Awaited<ReturnType<typeof getBookingById>>) {
  if (!booking) return res.status(404).json({ message: "Agendamento não encontrado." });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="amopets-agendamento-${booking.id}.pdf"`);
  const doc = new PDFDocument({ size: "A4", margin: 42 });
  doc.pipe(res);
  const teal = "#174b52"; const coral = "#e98c76"; const muted = "#64747a"; const line = "#d8e2df";
  const left = 42; const right = 553;
  const appointmentDate = new Date(`${booking.date}T12:00:00Z`).toLocaleDateString("pt-BR");

  doc.roundedRect(left, 42, right - left, 88, 14).fill(teal);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(23).text("amo", 64, 66, { continued: true }).fillColor(coral).text("pets");
  doc.fillColor("#dff2ef").font("Helvetica").fontSize(9).text("PETSHOP AFETIVO · ARACAJU/SE", 65, 96);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(12).text("COMPROVANTE DE AGENDAMENTO", 258, 67, { width: 270, align: "right", lineBreak: false });
  doc.font("Helvetica").fontSize(8.5).fillColor("#dff2ef").text(`Agendamento #${booking.id} · ${new Date(booking.createdAt).toLocaleString("pt-BR")}`, 258, 101, { width: 270, align: "right", lineBreak: false });

  doc.fillColor(teal).font("Helvetica-Bold").fontSize(10).text("DOCUMENTO DE SERVIÇO", left, 153);
  doc.fillColor(muted).font("Helvetica").fontSize(8).text("Este documento discrimina a solicitação de banho e tosa e não substitui comprovante de pagamento.", left, 169, { width: 511 });
  doc.moveTo(left, 190).lineTo(right, 190).strokeColor(line).stroke();

  doc.fillColor(teal).font("Helvetica-Bold").fontSize(10).text("CLIENTE E CONTATO", left, 211);
  doc.fillColor("#233d42").font("Helvetica").fontSize(9).text(`Cliente: ${booking.customerName}`, left, 229);
  doc.text(`WhatsApp: ${booking.whatsapp}`, left, 244);
  doc.fillColor(coral).font("Helvetica-Bold").text(`Status: ${bookingStatusLabel(booking.status)}`, 385, 229, { width: 168, align: "right" });

  doc.fillColor(teal).font("Helvetica-Bold").fontSize(10).text("DETALHES DO ATENDIMENTO", left, 290);
  doc.roundedRect(left, 309, right - left, 142, 8).fill("#e9f3f0");
  doc.fillColor("#233d42").font("Helvetica-Bold").fontSize(10).text("SERVIÇO", 62, 329);
  doc.font("Helvetica").fontSize(11).text(booking.serviceName, 62, 346, { width: 300 });
  doc.font("Helvetica-Bold").fontSize(10).text("PET", 62, 382);
  doc.font("Helvetica").fontSize(11).text(`${booking.petName} · Porte ${petSizeLabel(booking.petSize)}`, 62, 399, { width: 300 });
  doc.font("Helvetica-Bold").fontSize(10).text("DATA E HORÁRIO", 375, 329);
  doc.font("Helvetica").fontSize(11).text(`${appointmentDate} às ${booking.time}`, 375, 346, { width: 145, align: "right" });
  doc.font("Helvetica-Bold").fontSize(10).text("IDENTIFICAÇÃO", 375, 382);
  doc.font("Helvetica").fontSize(11).text(`#${booking.id}`, 375, 399, { width: 145, align: "right" });

  doc.fillColor(teal).font("Helvetica-Bold").fontSize(10).text("ORIENTAÇÕES", left, 490);
  doc.fillColor("#233d42").font("Helvetica").fontSize(9).text("A equipe AmoPets confirmará o horário pelo WhatsApp informado. Em caso de alteração ou cancelamento, entre em contato com a loja.", left, 509, { width: 511, lineGap: 3 });
  doc.fillColor(muted).fontSize(8).text("AmoPets · Rua dos Coqueiros, 245 · Jabotiana · Aracaju/SE · (79) 99662-0430", left, 752, { width: 511, align: "center" });
  doc.end();
}

export function registerBookingPdfRoutes(app: Express) {
  app.get("/api/admin/bookings/:id/pdf", async (req: Request, res: Response) => {
    const admin = await getAdminByRequest(req);
    if (!admin) return res.status(401).json({ message: "Sessão administrativa necessária." });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Agendamento inválido." });
    return sendBookingPdf(res, await getBookingById(id));
  });
}
