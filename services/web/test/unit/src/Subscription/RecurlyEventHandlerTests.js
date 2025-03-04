const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Subscription/RecurlyEventHandler'

describe('RecurlyEventHandler', function () {
  beforeEach(function () {
    this.userId = '123456789abcde'
    this.planCode = 'collaborator-annual'
    this.eventData = {
      account: {
        account_code: this.userId,
      },
      subscription: {
        plan: {
          plan_code: 'collaborator-annual',
        },
        quantity: 1,
        state: 'active',
        trial_started_at: new Date('2021-01-01 12:34:56'),
        trial_ends_at: new Date('2021-01-08 12:34:56'),
        current_period_started_at: new Date('2021-01-01 12:34:56'),
        current_period_ends_at: new Date('2021-01-08 12:34:56'),
      },
    }

    this.RecurlyEventHandler = SandboxedModule.require(modulePath, {
      requires: {
        './SubscriptionEmailHandler': (this.SubscriptionEmailHandler = {
          sendTrialOnboardingEmail: sinon.stub(),
        }),
        '../SplitTests/SplitTestV2Handler': (this.SplitTestV2Handler = {
          promises: {
            getAssignment: sinon.stub().resolves({ active: false }),
          },
        }),
        '../Analytics/AnalyticsManager': (this.AnalyticsManager = {
          recordEventForUser: sinon.stub(),
          setUserPropertyForUser: sinon.stub(),
        }),
      },
    })
  })

  it('with new_subscription_notification - free trial', function () {
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'new_subscription_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUser,
      this.userId,
      'subscription-started',
      {
        plan_code: this.planCode,
        quantity: 1,
        is_trial: true,
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUser,
      this.userId,
      'subscription-plan-code',
      this.planCode
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUser,
      this.userId,
      'subscription-state',
      'active'
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUser,
      this.userId,
      'subscription-is-trial',
      true
    )
    sinon.assert.calledWith(
      this.SplitTestV2Handler.promises.getAssignment,
      this.userId,
      'trial-onboarding-email'
    )
  })

  it('sends free trial onboarding email if user in ab group', async function () {
    this.SplitTestV2Handler.promises.getAssignment = sinon
      .stub()
      .resolves({ active: true, variant: 'send-email' })
    this.userId = '123456789trial'
    this.eventData.account.account_code = this.userId

    // testing directly on the send subscription started event to ensure the split handler
    // promise is resolved before checking calls
    await this.RecurlyEventHandler.sendSubscriptionStartedEvent(this.eventData)

    sinon.assert.calledWith(
      this.SplitTestV2Handler.promises.getAssignment,
      this.userId,
      'trial-onboarding-email'
    )
    sinon.assert.called(this.SubscriptionEmailHandler.sendTrialOnboardingEmail)
  })

  it('with new_subscription_notification - no free trial', function () {
    this.eventData.subscription.current_period_started_at = new Date(
      '2021-02-10 12:34:56'
    )
    this.eventData.subscription.current_period_ends_at = new Date(
      '2021-02-17 12:34:56'
    )
    this.eventData.subscription.quantity = 3

    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'new_subscription_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUser,
      this.userId,
      'subscription-started',
      {
        plan_code: this.planCode,
        quantity: 3,
        is_trial: false,
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUser,
      this.userId,
      'subscription-state',
      'active'
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUser,
      this.userId,
      'subscription-is-trial',
      false
    )
  })

  it('with updated_subscription_notification', function () {
    this.planCode = 'new-plan-code'
    this.eventData.subscription.plan.plan_code = this.planCode
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'updated_subscription_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUser,
      this.userId,
      'subscription-updated',
      {
        plan_code: this.planCode,
        quantity: 1,
        is_trial: true,
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUser,
      this.userId,
      'subscription-plan-code',
      this.planCode
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUser,
      this.userId,
      'subscription-state',
      'active'
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUser,
      this.userId,
      'subscription-is-trial',
      true
    )
  })

  it('with canceled_subscription_notification', function () {
    this.eventData.subscription.state = 'cancelled'
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'canceled_subscription_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUser,
      this.userId,
      'subscription-cancelled',
      {
        plan_code: this.planCode,
        quantity: 1,
        is_trial: true,
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUser,
      this.userId,
      'subscription-state',
      'cancelled'
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUser,
      this.userId,
      'subscription-is-trial',
      true
    )
  })

  it('with expired_subscription_notification', function () {
    this.eventData.subscription.state = 'expired'
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'expired_subscription_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUser,
      this.userId,
      'subscription-expired',
      {
        plan_code: this.planCode,
        quantity: 1,
        is_trial: true,
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUser,
      this.userId,
      'subscription-plan-code',
      this.planCode
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUser,
      this.userId,
      'subscription-state',
      'expired'
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.setUserPropertyForUser,
      this.userId,
      'subscription-is-trial',
      true
    )
  })

  it('with renewed_subscription_notification', function () {
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'renewed_subscription_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUser,
      this.userId,
      'subscription-renewed',
      {
        plan_code: this.planCode,
        quantity: 1,
        is_trial: true,
      }
    )
  })

  it('with reactivated_account_notification', function () {
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'reactivated_account_notification',
      this.eventData
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUser,
      this.userId,
      'subscription-reactivated',
      {
        plan_code: this.planCode,
        quantity: 1,
      }
    )
  })

  it('with paid_charge_invoice_notification', function () {
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'paid_charge_invoice_notification',
      {
        account: {
          account_code: this.userId,
        },
        invoice: {
          state: 'paid',
          total_in_cents: 720,
        },
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUser,
      this.userId,
      'subscription-invoice-collected'
    )
  })

  it('with paid_charge_invoice_notification and total_in_cents 0', function () {
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'paid_charge_invoice_notification',
      {
        account: {
          account_code: this.userId,
        },
        invoice: {
          state: 'paid',
          total_in_cents: 0,
        },
      }
    )
    sinon.assert.notCalled(this.AnalyticsManager.recordEventForUser)
  })

  it('with closed_invoice_notification', function () {
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'closed_invoice_notification',
      {
        account: {
          account_code: this.userId,
        },
        invoice: {
          state: 'collected',
          total_in_cents: 720,
        },
      }
    )
    sinon.assert.calledWith(
      this.AnalyticsManager.recordEventForUser,
      this.userId,
      'subscription-invoice-collected'
    )
  })

  it('with closed_invoice_notification and total_in_cents 0', function () {
    this.RecurlyEventHandler.sendRecurlyAnalyticsEvent(
      'closed_invoice_notification',
      {
        account: {
          account_code: this.userId,
        },
        invoice: {
          state: 'collected',
          total_in_cents: 0,
        },
      }
    )
    sinon.assert.notCalled(this.AnalyticsManager.recordEventForUser)
  })
})
