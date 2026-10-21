import { NextRequest, NextResponse } from 'next/server';
import { defaultController } from '@/lib/treasury/controller';

export async function GET() {
  try {
    const state = await defaultController.getState();
    return NextResponse.json({ success: true, data: state });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, obligationId, approverName, mode, depositAmount } = body;

    switch (action) {
      case 'reset': {
        defaultController.reset();
        const state = await defaultController.getState();
        return NextResponse.json({ success: true, message: 'Scenario reset to baseline.', data: state });
      }

      case 'plan': {
        const state = await defaultController.runInitialPlan();
        return NextResponse.json({ success: true, message: 'Deterministic plan generated.', data: state });
      }

      case 'approve': {
        if (!obligationId) {
          return NextResponse.json({ success: false, error: 'obligationId required for approval' }, { status: 400 });
        }
        const state = await defaultController.getState();
        const decision = state.currentPlan?.decisions.find(d => d.obligationId === obligationId);
        if (!decision) {
          return NextResponse.json({ success: false, error: 'Decision not found' }, { status: 404 });
        }
        const approvalGate = defaultController.getApprovalGate();
        const record = approvalGate.approveAction(decision, approverName || 'Lead Treasury Officer');
        return NextResponse.json({ success: true, message: 'Approval recorded', data: record });
      }

      case 'execute': {
        if (!obligationId) {
          return NextResponse.json({ success: false, error: 'obligationId required for execution' }, { status: 400 });
        }
        const res = await defaultController.executeDecision(obligationId);
        return NextResponse.json({ success: true, message: res.message, data: res.state });
      }

      case 'simulate_deposit': {
        const state = await defaultController.simulateDepositAndAdaptiveReplan(depositAmount);
        return NextResponse.json({
          success: true,
          message: 'Deposit simulated and adaptive plan recalculated.',
          data: state,
        });
      }

      case 'set_mode': {
        if (mode !== 'sandbox' && mode !== 'simulator') {
          return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 });
        }
        defaultController.getAdapter().setOperatingMode(mode);
        const state = await defaultController.getState();
        return NextResponse.json({ success: true, message: `Operating mode set to ${mode}`, data: state });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
