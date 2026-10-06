import { View } from 'react-native';
import type { InvestmentAdvice } from '@ft/core';
import { api } from '../../lib/api';
import { useMoney } from '../../lib/format';
import { keys, useApiMutation, useInvestment } from '../../lib/queries';
import { fonts, useTheme } from '../../lib/theme';
import { Button, Card, Empty, ErrorState, Loading, ProgressBar, Rise, T } from '../../components/ui';

const READINESS: Record<InvestmentAdvice['readiness']['status'], { label: string; tone: 'good' | 'bad' | 'ink' }> = {
  ready: { label: 'Ready to invest', tone: 'good' },
  'build-buffer': { label: 'Build your buffer first', tone: 'ink' },
  'not-ready': { label: 'Not yet', tone: 'bad' },
};

const ALLOCATION_COLORS = ['#2e9a68', '#3e63d6', '#8a6cd1', '#ee9a6c', '#f3c46b', '#78aedc'];

/** The AI investing coach: reads your habits and suggests where to start. */
export function InvestSection() {
  const money = useMoney();
  const { c } = useTheme();
  const q = useInvestment();
  const generate = useApiMutation(() => api('/ai/investment', { method: 'POST', body: {} }), [keys.investment]);

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />;
  const { summary: s, advice, configured } = q.data;

  if (s.monthsAnalyzed < 2) {
    return (
      <Empty icon="sparkles" title="Not enough history yet">
        After a couple of months of activity, the coach can look at your habits and suggest a starting point.
      </Empty>
    );
  }

  return (
    <>
      <Rise i={0}>
        <Card style={{ gap: 12, padding: 18 }}>
          <T v="eyebrow">Your habits</T>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Stat label="Kept each month" value={money(s.avgMonthlySurplus, { sign: true })} />
            <Stat label="Savings rate" value={`${Math.round(s.savingsRate * 100)}%`} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Stat label="Safety net" value={`${s.emergencyFundMonths.toFixed(1)} months`} />
            <Stat label="Recurring costs" value={money(s.recurringMonthlyCosts)} />
          </View>
        </Card>
      </Rise>

      {advice ? (
        <>
          <Rise i={1}>
            <Card style={{ gap: 10, padding: 18 }}>
              <T v="label" tone={READINESS[advice.readiness.status].tone}>
                {READINESS[advice.readiness.status].label}
              </T>
              <T tone="ink2">{advice.summary}</T>
              <T v="small" tone="muted">
                {advice.readiness.explanation}
              </T>
              {advice.monthlyInvestable > 0 ? (
                <T v="small">
                  You could invest about <T v="small" style={{ fontFamily: fonts.sansSemiBold }}>{money(advice.monthlyInvestable)}</T> a month.
                </T>
              ) : null}
            </Card>
          </Rise>
          {advice.allocation.length ? (
            <Rise i={2}>
              <Card style={{ gap: 14, padding: 18 }}>
                <T v="eyebrow">A starting mix ({advice.riskProfile})</T>
                {advice.allocation.map((a, i) => (
                  <View key={a.label} style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <T v="label">{a.label}</T>
                      <T v="label">{a.percent}%</T>
                    </View>
                    <ProgressBar value={a.percent / 100} color={ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]} />
                    <T v="caption" tone="muted">
                      {a.rationale}
                    </T>
                  </View>
                ))}
              </Card>
            </Rise>
          ) : null}
          <T v="caption" tone="muted">
            {advice.disclaimer} Generated {new Date(advice.generatedAt).toLocaleDateString()}.
          </T>
        </>
      ) : null}

      {configured ? (
        <Button title={advice ? 'Ask the coach again' : 'Ask the AI coach'} icon="sparkles" variant={advice ? 'secondary' : 'primary'} loading={generate.isPending} onPress={() => generate.mutate(undefined)} />
      ) : (
        <Card style={{ backgroundColor: c.surface2 }}>
          <T v="small" tone="muted">
            The AI coach isn’t switched on for this server (it needs an Anthropic API key).
          </T>
        </Card>
      )}
      {generate.isError ? <T tone="bad">{generate.error.message}</T> : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <T v="caption" tone="muted">
        {label}
      </T>
      <T v="figure" style={{ fontSize: 18 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
    </View>
  );
}
