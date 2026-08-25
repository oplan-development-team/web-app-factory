export interface ReceiptItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface AppState {
  storeName: string;
  /** value suitable for <input type="datetime-local"> */
  dateTimeLocal: string;
  items: ReceiptItem[];
  totalLabel: string;
  footerPhrase: string;
  poemMode: boolean;
  receiptNo: string;
}
