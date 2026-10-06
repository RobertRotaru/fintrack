import { View } from 'react-native';
import { router } from 'expo-router';
import { formatMoney, type Transaction } from '@ft/core';
import { formatDay } from '../lib/format';
import { fonts } from '../lib/theme';
import { IconTile, Row, T } from './ui';

/** One transaction: category icon, what and when, and the signed amount. Tap to edit. */
export function TxRow({ tx, accountName }: { tx: Transaction; accountName?: string }) {
  const income = tx.kind === 'income';
  return (
    <Row
      accessibilityRole="button"
      accessibilityLabel={`${tx.note || tx.categoryName}, ${formatMoney(income ? tx.amount : -tx.amount, tx.currency)}, ${formatDay(tx.date)}`}
      onPress={() => router.push({ pathname: '/quick-add', params: { id: tx.id } })}
    >
      <IconTile icon={tx.categoryIcon} color={tx.categoryColor} size={38} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="body" numberOfLines={1} style={{ fontFamily: fonts.sansMedium }}>
          {tx.note || tx.categoryName}
        </T>
        <T v="caption" tone="muted" numberOfLines={1}>
          {formatDay(tx.date)}
          {accountName ? ` · ${accountName}` : ''}
          {tx.note ? ` · ${tx.categoryName}` : ''}
        </T>
      </View>
      <T v="body" tone={income ? 'good' : 'ink'} style={{ fontFamily: fonts.sansSemiBold, fontVariant: ['tabular-nums'] }}>
        {formatMoney(income ? tx.amount : -tx.amount, tx.currency, { sign: income })}
      </T>
    </Row>
  );
}
