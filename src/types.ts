export type TxType = 'expense' | 'income';

export interface Category {
  id: number;
  name: string;
  icon: string;
  type: TxType;
  /** 一级分类为 null；「其他」的分项挂在其他分类的 id 下 */
  parentId: number | null;
  sort: number;
  isCustom: boolean;
}

export interface Account {
  id: number;
  name: string;
  icon: string;
  initBalance: number;
  sort: number;
  hidden: boolean;
}

export interface Tx {
  id: number;
  type: TxType;
  amount: number;
  categoryId: number;
  accountId: number;
  /** YYYY-MM-DD */
  date: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface TxWithNames extends Tx {
  categoryName: string;
  categoryIcon: string;
  accountName: string;
}

export type ThemeName = 'green' | 'blue' | 'purple' | 'orange';

export interface NewTx {
  type: TxType;
  amount: number;
  categoryId: number;
  accountId: number;
  date: string;
  note: string;
}
