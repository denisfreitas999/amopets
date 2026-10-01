import type { Express, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { getAdminByRequest } from "./adminAuth";
import { getOrderById } from "./db";

const money = (value: string | number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const statusLabel = (status: string) => ({ received: "Recebido", preparing: "Em preparo", out_for_delivery: "Saiu para entrega", delivered: "Entregue", cancelled: "Cancelado" }[status] || status);

function sendOrderPdf(res: Response, order: Awaited<ReturnType<typeof getOrderById>>) {
  if (!order) return res.status(404).json({ message: "Pedido não encontrado." });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="amopets-pedido-${order.orderNumber}.pdf"`);
  const doc = new PDFDocument({ size: "A4", margin: 42 });
  doc.pipe(res);
  const teal = "#174b52"; const coral = "#e98c76"; const muted = "#64747a"; const line = "#d8e2df";
  const left = 42; const right = 553;
  doc.roundedRect(left, 42, right - left, 88, 14).fill(teal);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(23).text("amo", 64, 66, { continued: true }).fillColor(coral).text("pets");
  doc.fillColor("#dff2ef").font("Helvetica").fontSize(9).text("PETSHOP AFETIVO · ARACAJU/SE", 65, 96);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(12).text("COMPROVANTE DE PEDIDO", 283, 67, { width: 250, align: "right", lineBreak: false });
  doc.font("Helvetica").fontSize(8.5).fillColor("#dff2ef").text(`Pedido #${order.orderNumber} · ${new Date(order.createdAt).toLocaleString("pt-BR")}`, 283, 101, { width: 250, align: "right", lineBreak: false });

  doc.fillColor(teal).font("Helvetica-Bold").fontSize(10).text("DOCUMENTO PERSONALIZADO DO PEDIDO", left, 153);
  doc.fillColor(muted).font("Helvetica").fontSize(8).text("Este comprovante registra a compra e não substitui uma Nota Fiscal Eletrônica (NF-e) oficial.", left, 169);
  doc.moveTo(left, 190).lineTo(right, 190).strokeColor(line).stroke();

  doc.fillColor(teal).font("Helvetica-Bold").fontSize(10).text("CLIENTE E ENTREGA", left, 211);
  doc.fillColor("#233d42").font("Helvetica").fontSize(9).text(`Cliente: ${order.customerName}`, left, 229);
  doc.text(`WhatsApp: ${order.whatsapp}`, left, 244);
  const address = [order.street, order.number, order.neighborhood, order.city && order.state ? `${order.city}/${order.state}` : "", order.complement].filter(Boolean).join(" · ");
  const addressText = `Endereço: ${address || "Não informado"}`;
  const addressY = 259;
  doc.text(addressText, left, addressY, { width: 330 });
  const paymentY = addressY + doc.heightOfString(addressText, { width: 330 }) + 8;
  doc.text(`Pagamento: ${order.paymentMethod}`, left, paymentY);
  doc.fillColor(coral).font("Helvetica-Bold").text(`Status: ${statusLabel(order.status)}`, 385, 229, { width: 168, align: "right" });

  let y = Math.max(318, paymentY + 30);
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(10).text("DISCRIMINAÇÃO DOS ITENS", left, y); y += 20;
  doc.roundedRect(left, y, right - left, 24, 4).fill("#e9f3f0");
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(8).text("ITEM", 52, y + 8); doc.text("QTD.", 390, y + 8); doc.text("UNITÁRIO", 430, y + 8); doc.text("TOTAL", 495, y + 8); y += 31;
  doc.font("Helvetica").fontSize(9).fillColor("#233d42");
  for (const item of order.items) {
    const label = `${item.productName}${item.variantLabel ? ` · ${item.variantLabel}` : ""}`;
    doc.text(label, 52, y, { width: 325 }); doc.text(String(item.quantity), 390, y, { width: 30, align: "center" }); doc.text(money(item.unitPrice), 430, y, { width: 58, align: "right" }); doc.text(money(Number(item.unitPrice) * item.quantity), 495, y, { width: 58, align: "right" });
    y += 23; doc.moveTo(left, y - 7).lineTo(right, y - 7).strokeColor("#edf1f0").stroke();
  }
  y += 10;
  const summaryX = 350;
  const row = (label: string, value: string, bold = false, color = "#233d42") => { doc.fillColor(color).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9).text(label, summaryX, y, { width: 100 }); doc.text(value, 450, y, { width: 100, align: "right" }); y += bold ? 25 : 18; };
  row("Subtotal", money(order.subtotal)); row("Frete", money(order.shippingFee)); if (Number(order.discount) > 0) row("Desconto", `- ${money(order.discount)}`, false, "#17815d");
  doc.moveTo(summaryX, y - 6).lineTo(right, y - 6).strokeColor(teal).stroke(); row("TOTAL", money(order.total), true, teal);
  doc.fillColor(muted).font("Helvetica").fontSize(8).text("Agradecemos a preferência. Para confirmar disponibilidade, prazo e pagamento, fale conosco pelo WhatsApp.", left, 735, { width: 511, align: "center" });
  doc.fillColor(muted).fontSize(7).text("AmoPets · Rua dos Coqueiros, 245 · Jabotiana · Aracaju/SE · (79) 99662-0430", left, 752, { width: 511, align: "center" });
  doc.end();
}

export function registerOrderPdfRoutes(app: Express) {
  app.get("/api/admin/orders/:id/pdf", async (req: Request, res: Response) => {
    const admin = await getAdminByRequest(req);
    if (!admin) return res.status(401).json({ message: "Sessão administrativa necessária." });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Pedido inválido." });
    return sendOrderPdf(res, await getOrderById(id));
  });

}
