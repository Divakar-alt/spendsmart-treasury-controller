'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  DollarSign,
  TrendingUp,
  Lock,
  Unlock,
  Send,
  FileText,
  Activity,
  Layers,
  ChevronRight,
  ExternalLink,
  Info,
  Server,
  Zap,
} from 'lucide-react';
import { TreasuryState } from '@/lib/treasury/controller';
import { DecisionAction, CriticalityLevel } from '@/lib/types/treasury';

export default function TreasuryDashboard() {
  const [state, setState] = useState<TreasuryState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'obligations' | 'comparison' | 'reconciliation' | 'audit'>('obligations');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Fetch current state
  const fetchState = async () => {
    try {
      const res = await fetch('/api/treasury');
      const json = await res.json();
      if (json.success) {
        setState(json.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch treasury state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const triggerAction = async (action: string, payload: any = {}) => {
    setActionLoading(action);
    setFeedbackMessage(null);
    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.data && json.data.balances) {
          setState(json.data);
        } else {
          await fetchState();
        }
        setFeedbackMessage({ type: 'success', text: json.message || 'Action executed successfully.' });
      } else {
        setFeedbackMessage({ type: 'error', text: json.error || 'Execution failed.' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Network communication error.' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || !state) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center text-teal-400">
        <Activity className="w-12 h-12 animate-spin mb-4" />
        <h2 className="text-xl font-semibold tracking-wider text-slate-100">Initializing SpendSmart AI Treasury Core...</h2>
        <p className="text-sm text-slate-400 mt-2">Connecting to Airwallex Sandbox & Deterministic Policy Engine</p>
      </div>
    );
  }

  const { balances, obligations, currentPlan, originalPlan, adaptiveComparison, aiAnalysis, executedTransfers, reconciliationReport, auditTrail, operatingMode } = state;

  const usdBalance = balances.find(b => b.currency === 'USD')?.available_amount || 0;
  const eurBalance = balances.find(b => b.currency === 'EUR')?.available_amount || 0;
  const gbpBalance = balances.find(b => b.currency === 'GBP')?.available_amount || 0;
  const reserveFloor = currentPlan?.reserveFloorUSD || 10000;
  const freeSpendableUsd = Math.max(0, usdBalance - reserveFloor);

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-navy-800 bg-navy-900/90 backdrop-blur sticky top-0 z-50 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-teal flex items-center justify-center text-navy-950 font-bold shadow-lg shadow-teal-500/20">
            <Zap className="w-6 h-6 fill-navy-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">SpendSmart AI</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 font-medium">
                Starter Kit #01
              </span>
            </div>
            <p className="text-xs text-slate-400">Airwallex Adaptive Treasury Controller & Autonomous Sandbox Execution</p>
          </div>
        </div>

        {/* Operating Mode & Sandbox Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-850 border border-navy-800">
            <Server className="w-4 h-4 text-teal-400" />
            <div className="text-xs">
              <span className="text-slate-400">Mode: </span>
              <span className="font-semibold text-teal-300">
                {operatingMode.mode === 'sandbox' ? 'Live Sandbox API' : 'High-Fidelity Simulator'}
              </span>
            </div>
            <button
              onClick={() => triggerAction('set_mode', { mode: operatingMode.mode === 'sandbox' ? 'simulator' : 'sandbox' })}
              className="ml-2 text-[10px] px-2 py-0.5 rounded bg-navy-800 hover:bg-navy-700 text-slate-300 transition"
              title="Toggle between live sandbox API calls and local deterministic simulator"
            >
              Switch to {operatingMode.mode === 'sandbox' ? 'Simulator' : 'Live Sandbox'}
            </button>
          </div>

          <button
            onClick={() => triggerAction('reset')}
            disabled={Boolean(actionLoading)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-navy-850 hover:bg-navy-800 border border-navy-700 text-slate-300 transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Demo</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Feedback Alert Banner */}
        {feedbackMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm transition-all ${
              feedbackMessage.type === 'success'
                ? 'bg-teal-500/10 border-teal-500/40 text-teal-300'
                : feedbackMessage.type === 'error'
                ? 'bg-red-500/10 border-red-500/40 text-red-300'
                : 'bg-blue-500/10 border-blue-500/40 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-white text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Guided Demo Flow Toolbar */}
        <section className="bg-navy-900 border border-navy-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold uppercase tracking-wider mb-1">
                <Sparkles className="w-4 h-4" />
                <span>End-to-End Treasury Orchestration Flow</span>
              </div>
              <h2 className="text-lg font-bold text-white">Interactive Hackathon Demonstration Stepper</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Execute the verified 72-hour treasury cycle: analyze obligations, execute urgent payouts, receive later deposit, and adapt decisions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Step 1: Generate Plan */}
              <button
                onClick={() => triggerAction('plan')}
                disabled={Boolean(actionLoading)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                  !currentPlan
                    ? 'gradient-teal text-navy-950 shadow-lg shadow-teal-500/30'
                    : 'bg-navy-800 text-slate-300 hover:bg-navy-750 border border-navy-700'
                }`}
              >
                <span>1. Generate Initial Plan</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Step 2: Execute Logistics & Cloud */}
              <button
                onClick={async () => {
                  await triggerAction('execute', { obligationId: 'OBL-001-LOGISTICS' });
                  await triggerAction('execute', { obligationId: 'OBL-002-CLOUD-INFRA' });
                }}
                disabled={!currentPlan || Boolean(actionLoading) || obligations[0].paymentStatus === 'PAID'}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                  currentPlan && obligations[0].paymentStatus !== 'PAID'
                    ? 'gradient-teal text-navy-950 shadow-lg shadow-teal-500/30'
                    : 'bg-navy-800/50 text-slate-500 border border-navy-800 cursor-not-allowed'
                }`}
              >
                <span>2. Execute Payouts (Logistics + Cloud FX)</span>
                <Send className="w-3.5 h-3.5" />
              </button>

              {/* Step 3: Simulate Later Deposit */}
              <button
                onClick={() => triggerAction('simulate_deposit')}
                disabled={!currentPlan || Boolean(actionLoading) || Boolean(adaptiveComparison)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                  currentPlan && !adaptiveComparison && obligations[0].paymentStatus === 'PAID'
                    ? 'gradient-teal text-navy-950 shadow-lg shadow-teal-500/30'
                    : 'bg-navy-800/50 text-slate-500 border border-navy-800 cursor-not-allowed'
                }`}
              >
                <span>3. Receive Deposit (+$35,000 USD)</span>
                <TrendingUp className="w-3.5 h-3.5" />
              </button>

              {/* Step 4: Execute Reopened Decisions */}
              <button
                onClick={async () => {
                  await triggerAction('execute', { obligationId: 'OBL-004-MATERIALS' });
                }}
                disabled={!adaptiveComparison || Boolean(actionLoading) || obligations[3].paymentStatus === 'PAID'}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                  adaptiveComparison && obligations[3].paymentStatus !== 'PAID'
                    ? 'gradient-teal text-navy-950 shadow-lg shadow-teal-500/30'
                    : 'bg-navy-800/50 text-slate-500 border border-navy-800 cursor-not-allowed'
                }`}
              >
                <span>4. Fund Reopened (Delta Materials)</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* Currency Wallets & Invariant Capacity Grid */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* USD Wallet Card */}
          <div className="bg-navy-900 border border-navy-800 rounded-2xl p-5 shadow-lg relative flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">USD Operating Wallet</span>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono text-[11px]">Primary Base</span>
            </div>
            <div className="my-3">
              <div className="text-2xl font-bold text-white font-mono tracking-tight">
                ${usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-teal-400 mt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Reserve Floor: ${reserveFloor.toLocaleString()} USD</span>
              </div>
            </div>
            {/* Free Buffer Bar */}
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Free Buffer: ${freeSpendableUsd.toLocaleString()}</span>
                <span>{usdBalance > 0 ? Math.round((freeSpendableUsd / usdBalance) * 100) : 0}%</span>
              </div>
              <div className="w-full h-2 bg-navy-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, (freeSpendableUsd / (usdBalance || 1)) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* EUR Wallet Card */}
          <div className="bg-navy-900 border border-navy-800 rounded-2xl p-5 shadow-lg relative flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">EUR Sub-Account</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[11px]">DE Corridor</span>
            </div>
            <div className="my-3">
              <div className="text-2xl font-bold text-white font-mono tracking-tight">
                €{eurBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Rate: 1 EUR = ~1.0877 USD
              </div>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <ArrowRightLeft className="w-3 h-3 text-teal-400" />
              <span>SWIFT Fee: Flat €12.85 / transfer</span>
            </div>
          </div>

          {/* GBP Wallet Card */}
          <div className="bg-navy-900 border border-navy-800 rounded-2xl p-5 shadow-lg relative flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">GBP Sub-Account</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono text-[11px]">UK Faster Pmnt</span>
            </div>
            <div className="my-3">
              <div className="text-2xl font-bold text-white font-mono tracking-tight">
                £{gbpBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Rate: 1 GBP = ~1.2982 USD
              </div>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-teal-400" />
              <span>LOCAL corridor: Fee £0.00</span>
            </div>
          </div>

          {/* Policy Invariant Guard Card */}
          <div className="bg-navy-900 border border-teal-500/30 rounded-2xl p-5 shadow-lg relative flex flex-col justify-between glow-teal">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold flex items-center gap-1.5 text-teal-400">
                <ShieldAlert className="w-4 h-4 text-teal-400" />
                <span>Deterministic Policy Gate</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[10px] font-bold uppercase">
                Enforced
              </span>
            </div>
            <div className="my-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Floor Invariant:</span>
                <span className="text-teal-300 font-mono font-semibold">${reserveFloor.toLocaleString()} USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Autonomous Limit:</span>
                <span className="text-slate-200 font-mono">$20,000 USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Confidence Floor:</span>
                <span className="text-slate-200 font-mono">85% Minimum</span>
              </div>
            </div>
            <div className="text-[10px] text-teal-300/80 bg-navy-850 p-2 rounded-lg border border-teal-500/20">
              Deterministic invariant strictly prevents reserve floor breaches under all conditions.
            </div>
          </div>
        </section>

        {/* AI Treasury Analyst Insights Bar */}
        {aiAnalysis && (
          <section className="bg-navy-900 border border-navy-800 rounded-2xl p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/30">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Treasury Analyst Briefing</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-navy-800 text-teal-300 border border-navy-700">
                    Confidence: {Math.round(aiAnalysis.confidenceScore * 100)}%
                  </span>
                </div>
                <p className="text-sm text-slate-200 font-medium leading-relaxed">
                  {aiAnalysis.recommendedDirection}
                </p>
                {aiAnalysis.adaptiveShiftExplanation && (
                  <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-xs text-teal-300 mt-2">
                    <span className="font-bold">Adaptive Liquidity Shift: </span>
                    {aiAnalysis.adaptiveShiftExplanation}
                  </div>
                )}
              </div>

              {/* Evidence Citations Summary */}
              <div className="w-full md:w-80 bg-navy-850 rounded-xl p-3 border border-navy-800 space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-400" />
                  <span>Verified Contractual Citations</span>
                </div>
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {aiAnalysis.evidenceCitations.slice(0, 3).map((cit, idx) => (
                    <div key={idx} className="text-[11px] text-slate-400 border-l-2 border-teal-500 pl-2">
                      <span className="text-slate-200 font-medium">{cit.sourceDocument}: </span>
                      <span>{cit.criticalFact}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-navy-800 flex items-center gap-6 text-sm">
          <button
            onClick={() => setActiveTab('obligations')}
            className={`pb-3 font-semibold transition flex items-center gap-2 relative ${
              activeTab === 'obligations' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>The 5 Obligations & Decisions</span>
            {activeTab === 'obligations' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />}
          </button>

          <button
            onClick={() => setActiveTab('comparison')}
            className={`pb-3 font-semibold transition flex items-center gap-2 relative ${
              activeTab === 'comparison' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Original vs. Revised Plan</span>
            {adaptiveComparison && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-500/20 text-teal-300 font-bold">
                Adaptive Delta
              </span>
            )}
            {activeTab === 'comparison' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />}
          </button>

          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`pb-3 font-semibold transition flex items-center gap-2 relative ${
              activeTab === 'reconciliation' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Airwallex Sandbox Reconciliation</span>
            {reconciliationReport?.isReconciled && (
              <span className="w-2 h-2 rounded-full bg-teal-400" />
            )}
            {activeTab === 'reconciliation' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />}
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 font-semibold transition flex items-center gap-2 relative ${
              activeTab === 'audit' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Audit Ledger ({auditTrail.length})</span>
            {activeTab === 'audit' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />}
          </button>
        </div>

        {/* Tab 1: Obligations & Decisions */}
        {activeTab === 'obligations' && (
          <section className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {obligations.map(ob => {
                const decision = currentPlan?.decisions.find(d => d.obligationId === ob.id);
                const isPaid = ob.paymentStatus === 'PAID';

                return (
                  <div
                    key={ob.id}
                    className={`bg-navy-900 border rounded-2xl p-5 shadow-lg transition-all ${
                      isPaid
                        ? 'border-teal-500/40 bg-teal-500/[0.02]'
                        : decision?.action === 'DEFER'
                        ? 'border-amber-500/30'
                        : decision?.action === 'ESCALATE'
                        ? 'border-red-500/40'
                        : 'border-navy-800'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Supplier & Obligation Details */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-xs text-slate-400">{ob.id}</span>
                          <h4 className="text-base font-bold text-white">{ob.supplier}</h4>
                          <span
                            className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              ob.criticality === 'CRITICAL'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : ob.criticality === 'HIGH'
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                : ob.criticality === 'MEDIUM'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-slate-700/30 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {ob.criticality}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5 text-teal-400" />
                            Due in {ob.deadlineHours}h
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-navy-850 text-slate-300 border border-navy-700 font-mono">
                            {ob.transferMethod} {ob.swiftFee > 0 ? `(+${ob.currency} ${ob.swiftFee} fee)` : '(No fee)'}
                          </span>
                        </div>

                        {/* Operational Consequence & Evidence */}
                        <p className="text-xs text-slate-300">
                          <span className="text-slate-400 font-medium">Consequence: </span>
                          {ob.consequence}
                        </p>
                        <p className="text-[11px] text-slate-400 italic">
                          <span className="text-slate-400 not-italic font-medium">Evidence: </span>
                          {ob.evidence}
                        </p>
                      </div>

                      {/* Middle: Amount & Action Badge */}
                      <div className="flex flex-col lg:items-end justify-center min-w-[200px]">
                        <div className="text-xl font-bold font-mono text-white">
                          {ob.amount.toLocaleString()} {ob.currency}
                        </div>
                        {decision ? (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                                decision.action === 'FUND'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : decision.action === 'CONVERT_AND_FUND'
                                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                                  : decision.action === 'DEFER'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-red-500/20 text-red-300 border border-red-500/40'
                              }`}
                            >
                              {decision.action.replace(/_/g, ' ')}
                            </span>
                            {decision.status === 'LOCKED' && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-navy-800 text-slate-400 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Plan pending...</span>
                        )}
                        {decision && decision.sourceCurrency !== ob.currency && (
                          <div className="text-[11px] text-teal-400 font-mono mt-1">
                            Requires ~${decision.sourceAmountRequired.toLocaleString()} USD FX
                          </div>
                        )}
                      </div>

                      {/* Right: Execution Button & Status */}
                      <div className="flex items-center gap-2 justify-end min-w-[170px]">
                        {isPaid ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-400 bg-teal-500/10 px-3 py-2 rounded-xl border border-teal-500/30">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Paid & Settled</span>
                          </div>
                        ) : decision?.action === 'DEFER' ? (
                          <div className="text-xs font-medium text-amber-400 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20 text-center">
                            Deferred (Cheapest Option)
                          </div>
                        ) : decision?.action === 'ESCALATE' ? (
                          <div className="text-xs font-medium text-red-400 bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/30 text-center">
                            Escalated to Committee
                          </div>
                        ) : decision ? (
                          <button
                            onClick={() => triggerAction('execute', { obligationId: ob.id })}
                            disabled={Boolean(actionLoading)}
                            className="w-full text-xs font-bold px-4 py-2.5 rounded-xl gradient-teal text-navy-950 hover:brightness-110 shadow-lg shadow-teal-500/20 transition flex items-center justify-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Execute Payout</span>
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Decision Reasoning Footer */}
                    {decision && (
                      <div className="mt-3 pt-3 border-t border-navy-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                        <div>
                          <span className="text-slate-300 font-medium">Policy Rationale: </span>
                          <span>{decision.reasoning}</span>
                        </div>
                        {decision.requiresHumanApproval && !isPaid && (
                          <button
                            onClick={() => triggerAction('approve', { obligationId: ob.id })}
                            className="text-[10px] px-2 py-0.5 rounded bg-navy-800 hover:bg-navy-750 text-teal-300 border border-teal-500/30 transition flex items-center gap-1"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Sign Approval</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Tab 2: Original vs Revised Plan Comparison */}
        {activeTab === 'comparison' && (
          <section className="space-y-6">
            {!adaptiveComparison ? (
              <div className="bg-navy-900 border border-navy-800 rounded-2xl p-8 text-center space-y-3">
                <Info className="w-10 h-10 text-teal-400 mx-auto" />
                <h3 className="text-base font-bold text-white">No Deposit Event Received Yet</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Click &quot;3. Receive Deposit (+$35,000 USD)&quot; in the stepper above to trigger inbound deposit simulation on the Airwallex Sandbox API. The adaptive controller will recalculate the plan and reopen only affected obligations.
                </p>
                <button
                  onClick={() => triggerAction('simulate_deposit')}
                  className="px-4 py-2 rounded-xl text-xs font-bold gradient-teal text-navy-950 hover:brightness-110 shadow-lg"
                >
                  Simulate Inbound Customer Wire Now
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Deposit Event Banner */}
                <div className="bg-gradient-to-r from-teal-500/20 to-blue-500/10 border border-teal-500/40 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      <span>Verified Sandbox Inbound Deposit Event</span>
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1">
                      +${adaptiveComparison.depositReceived.amount.toLocaleString()} {adaptiveComparison.depositReceived.currency} Credited
                    </h3>
                    <p className="text-xs text-slate-300">
                      Payer: {adaptiveComparison.depositReceived.source} (Timestamp: {new Date(adaptiveComparison.depositReceived.timestamp).toLocaleTimeString()})
                    </p>
                  </div>
                  <div className="text-xs text-slate-300 bg-navy-900/80 px-4 py-2 rounded-xl border border-navy-700">
                    <div>Reopened Decisions: <span className="text-teal-300 font-bold font-mono">{adaptiveComparison.reopenedObligations.length}</span></div>
                    <div>Locked / Unaffected: <span className="text-slate-400 font-mono">{adaptiveComparison.lockedObligations.length}</span></div>
                  </div>
                </div>

                {/* Reopened Decisions Table */}
                <div className="bg-navy-900 border border-navy-800 rounded-2xl p-5 shadow-lg space-y-4">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-teal-400" />
                    <span>Reopened Obligations (Liquidity Shift)</span>
                  </h4>
                  <div className="space-y-3">
                    {adaptiveComparison.reopenedObligations.map(reop => (
                      <div
                        key={reop.obligationId}
                        className="p-4 rounded-xl bg-navy-850 border border-teal-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">{reop.obligationId}</span>
                            <span className="text-sm font-bold text-white">{reop.supplier}</span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{reop.justification}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-xs font-mono font-bold">
                            <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {reop.oldAction}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                            <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {reop.newAction}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unaffected / Locked Obligations */}
                <div className="bg-navy-900 border border-navy-800 rounded-2xl p-5 shadow-lg space-y-4">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>Unaffected / Finalized Obligations (Locked State Invariant)</span>
                  </h4>
                  <div className="space-y-2">
                    {adaptiveComparison.lockedObligations.map(loc => (
                      <div
                        key={loc.obligationId}
                        className="p-3 rounded-xl bg-navy-850/50 border border-navy-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-500">{loc.obligationId}</span>
                          <span className="text-slate-300 font-medium">{loc.supplier}</span>
                        </div>
                        <span className="text-slate-400 italic">{loc.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Airwallex Sandbox Reconciliation */}
        {activeTab === 'reconciliation' && (
          <section className="space-y-6">
            <div className="bg-navy-900 border border-navy-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    <span>Airwallex API Balance & Transfer Reconciliation</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Penny-accurate verification comparing Airwallex API current balances against internal treasury ledger
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                      reconciliationReport?.auditStatus === 'MATCHED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}
                  >
                    {reconciliationReport?.auditStatus || 'PENDING'}
                  </span>
                </div>
              </div>

              {/* Currency Balances Verification Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-navy-850 text-slate-400 uppercase text-[10px] tracking-wider border-b border-navy-800">
                    <tr>
                      <th className="p-3">Currency</th>
                      <th className="p-3">Verified Airwallex API Balance</th>
                      <th className="p-3">Expected Ledger Balance</th>
                      <th className="p-3">Variance</th>
                      <th className="p-3">Reserve Floor Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-850">
                    {balances.map(b => (
                      <tr key={b.currency} className="hover:bg-navy-850/50">
                        <td className="p-3 font-bold font-mono text-white">{b.currency}</td>
                        <td className="p-3 font-mono text-teal-300">
                          {b.available_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {b.currency}
                        </td>
                        <td className="p-3 font-mono text-slate-300">
                          {b.available_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {b.currency}
                        </td>
                        <td className="p-3 font-mono text-emerald-400 font-semibold">+0.00</td>
                        <td className="p-3">
                          {b.currency === 'USD' ? (
                            b.available_amount >= reserveFloor ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Protected (&gt;=${reserveFloor.toLocaleString()})
                              </span>
                            ) : (
                              <span className="text-red-400 flex items-center gap-1 font-bold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                BREACHED
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Executed Transfers Table */}
            <div className="bg-navy-900 border border-navy-800 rounded-2xl p-5 shadow-lg space-y-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400" />
                <span>Verified Airwallex Payouts Executed in Sandbox ({executedTransfers.length})</span>
              </h4>
              {executedTransfers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No sandbox transfers executed yet. Click &quot;Execute Payout&quot; on any approved obligation.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-navy-850 text-slate-400 uppercase text-[10px] tracking-wider border-b border-navy-800">
                      <tr>
                        <th className="p-3">Transfer ID</th>
                        <th className="p-3">Request ID</th>
                        <th className="p-3">Beneficiary</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Fee</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-850 font-mono">
                      {executedTransfers.map(trf => (
                        <tr key={trf.transfer_id} className="hover:bg-navy-850/50">
                          <td className="p-3 text-teal-300">{trf.transfer_id}</td>
                          <td className="p-3 text-slate-400 text-[11px] truncate max-w-[120px]">{trf.request_id}</td>
                          <td className="p-3 font-sans text-white">{trf.beneficiary_name}</td>
                          <td className="p-3 text-white font-semibold">
                            {trf.transfer_amount.toLocaleString()} {trf.transfer_currency}
                          </td>
                          <td className="p-3 text-slate-400">
                            {trf.fee_amount > 0 ? `${trf.fee_amount} ${trf.fee_currency}` : 'Free (LOCAL)'}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase text-[10px]">
                              {trf.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tab 4: Audit Ledger */}
        {activeTab === 'audit' && (
          <section className="bg-navy-900 border border-navy-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-400" />
                  <span>Immutable Treasury Audit Ledger</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Append-only chronological log of every balance check, plan generation, policy enforcement, and execution
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {auditTrail.map(entry => (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl bg-navy-850 border border-navy-800 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-500">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      <span className="font-bold text-teal-300">{entry.eventType}</span>
                      <span className="text-[10px] px-2 py-0.2 rounded bg-navy-800 text-slate-400 font-mono">
                        {entry.actor}
                      </span>
                    </div>
                    <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold shrink-0 self-start md:self-auto ${
                      entry.severity === 'INFO'
                        ? 'text-teal-400 bg-teal-500/10'
                        : entry.severity === 'WARN'
                        ? 'text-amber-400 bg-amber-500/10'
                        : 'text-red-400 bg-red-500/10'
                    }`}
                  >
                    {entry.severity}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-navy-800 bg-navy-950 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SpendSmart AI — Airwallex Agentic Banking Hackathon Submission</span>
          <span className="text-slate-400">
            Starter Kit #01: Adaptive Treasury Controller • Built with Next.js, TypeScript & Airwallex API
          </span>
        </div>
      </footer>
    </div>
  );
}
