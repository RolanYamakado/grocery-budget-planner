import type { WeeklyPlan } from '../types';
import { STORES_BY_ID } from '../data/stores';
import { INGREDIENTS_BY_ID } from '../data/ingredients';
import { groupShoppingListByStore } from './shareContent';

export async function generatePlanPdf(plan: WeeklyPlan): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 15;

  function line(text: string, size = 11, bold = false) {
    if (y > pageHeight - 15) {
      doc.addPage();
      y = 15;
    }
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(text, 10, y);
    y += size < 12 ? 6 : 8;
  }

  line('Grocery plan', 16, true);
  line(`Budget £${plan.budgetGBP.toFixed(2)} — Total £${plan.totalCostGBP.toFixed(2)}`);
  y += 2;

  for (const [storeId, lines] of groupShoppingListByStore(plan.shoppingList)) {
    line(STORES_BY_ID[storeId]?.name ?? storeId, 13, true);
    for (const l of lines) {
      const name = INGREDIENTS_BY_ID[l.ingredientId]?.name ?? l.ingredientId;
      line(`  ${l.packagesNeeded} x ${l.packageLabel} — ${name} (£${l.lineCostGBP.toFixed(2)})`);
    }
    y += 2;
  }

  doc.save(`grocery-plan-${plan.weekStartDate}.pdf`);
}
