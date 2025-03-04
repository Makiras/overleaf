import _ from 'lodash'
/* global recurly */

/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../base'
import getMeta from '../utils/meta'
const SUBSCRIPTION_URL = '/user/subscription/update'

const ensureRecurlyIsSetup = _.once(() => {
  if (typeof recurly === 'undefined' || !recurly) {
    return false
  }
  recurly.configure(getMeta('ol-recurlyApiKey'))
  return true
})

App.controller('MetricsEmailController', function ($scope, $http) {
  $scope.institutionEmailSubscription = function (institutionId) {
    var inst = _.find(window.managedInstitutions, function (institution) {
      return institution.v1Id === parseInt(institutionId)
    })
    if (inst.metricsEmail.optedOutUserIds.includes(window.user_id)) {
      return 'Subscribe'
    } else {
      return 'Unsubscribe'
    }
  }

  $scope.changeInstitutionalEmailSubscription = function (institutionId) {
    $scope.subscriptionChanging = true
    return $http({
      method: 'POST',
      url: `/institutions/${institutionId}/emailSubscription`,
      headers: {
        'X-CSRF-Token': window.csrfToken,
      },
    }).then(function successCallback(response) {
      window.managedInstitutions = _.map(
        window.managedInstitutions,
        function (institution) {
          if (institution.v1Id === parseInt(institutionId)) {
            institution.metricsEmail.optedOutUserIds = response.data
          }
          return institution
        }
      )
      $scope.subscriptionChanging = false
    })
  }
})

App.factory('RecurlyPricing', function ($q, MultiCurrencyPricing) {
  return {
    loadDisplayPriceWithTax: function (planCode, currency, taxRate) {
      if (!ensureRecurlyIsSetup()) return
      const currencySymbol = MultiCurrencyPricing.plans[currency].symbol
      const pricing = recurly.Pricing()
      return $q(function (resolve, reject) {
        pricing
          .plan(planCode, { quantity: 1 })
          .currency(currency)
          .done(function (price) {
            const totalPriceExTax = parseFloat(price.next.total)
            let taxAmmount = totalPriceExTax * taxRate
            if (isNaN(taxAmmount)) {
              taxAmmount = 0
            }
            let total = totalPriceExTax + taxAmmount
            if (total % 1 !== 0) {
              total = total.toFixed(2)
            }
            resolve(`${currencySymbol}${total}`)
          })
      })
    },
  }
})

App.controller('ChangePlanToGroupFormController', function ($scope, $modal) {
  if (!ensureRecurlyIsSetup()) return

  const subscription = getMeta('ol-subscription')
  const currency = subscription.recurly.currency

  if (['USD', 'GBP', 'EUR'].includes(currency)) {
    $scope.isValidCurrencyForUpgrade = true
  }

  $scope.openGroupPlanModal = function () {
    const planCode = subscription.plan.planCode
    $scope.defaultGroupPlan = planCode.includes('professional')
      ? 'professional'
      : 'collaborator'
    $scope.currentPlanCurrency = currency
    $modal.open({
      templateUrl: 'groupPlanModalUpgradeTemplate',
      controller: 'GroupPlansModalUpgradeController',
      scope: $scope,
    })
  }
})

App.controller(
  'GroupPlansModalUpgradeController',
  function ($scope, $modal, $location, $http) {
    $scope.options = {
      plan_codes: [
        {
          display: 'Collaborator',
          code: 'collaborator',
        },
        {
          display: 'Professional',
          code: 'professional',
        },
      ],
      currencies: [
        {
          display: 'USD ($)',
          code: 'USD',
        },
        {
          display: 'GBP (£)',
          code: 'GBP',
        },
        {
          display: 'EUR (€)',
          code: 'EUR',
        },
      ],
      currencySymbols: {
        USD: '$',
        EUR: '€',
        GBP: '£',
      },
      sizes: [2, 3, 4, 5, 10, 20, 50],
      usages: [
        {
          display: 'Enterprise',
          code: 'enterprise',
        },
        {
          display: 'Educational',
          code: 'educational',
        },
      ],
    }

    $scope.prices = getMeta('ol-groupPlans')

    const currency = $scope.currentPlanCurrency

    // default selected
    $scope.selected = {
      plan_code: $scope.defaultGroupPlan || 'collaborator',
      currency,
      size: '10',
      usage: 'enterprise',
    }

    $scope.recalculatePrice = function () {
      const { usage, plan_code, currency, size } = $scope.selected
      const price = $scope.prices[usage][plan_code][currency][size]
      const currencySymbol = $scope.options.currencySymbols[currency]
      $scope.displayPrice = `${currencySymbol}${price}`
    }

    $scope.$watch('selected', $scope.recalculatePrice, true)
    $scope.recalculatePrice()

    $scope.upgrade = function () {
      const { plan_code, size, usage } = $scope.selected
      const body = {
        _csrf: window.csrfToken,
        plan_code: `group_${plan_code}_${size}_${usage}`,
      }
      $scope.inflight = true
      $http
        .post(`/user/subscription/update`, body)
        .then(() => location.reload())
    }
  }
)

App.controller(
  'ChangePlanFormController',
  function ($scope, $modal, RecurlyPricing) {
    if (!ensureRecurlyIsSetup()) return

    $scope.changePlan = () =>
      $modal.open({
        templateUrl: 'confirmChangePlanModalTemplate',
        controller: 'ConfirmChangePlanController',
        scope: $scope,
      })

    $scope.cancelPendingPlanChange = () =>
      $modal.open({
        templateUrl: 'cancelPendingPlanChangeModalTemplate',
        controller: 'CancelPendingPlanChangeController',
        scope: $scope,
      })

    $scope.$watch('plan', function (plan) {
      if (!plan) return
      const planCodesChangingAtTermEnd = getMeta(
        'ol-planCodesChangingAtTermEnd'
      )
      $scope.planChangesAtTermEnd = false
      if (
        planCodesChangingAtTermEnd &&
        planCodesChangingAtTermEnd.indexOf(plan.planCode) > -1
      ) {
        $scope.planChangesAtTermEnd = true
      }
      const planCode = plan.planCode
      const subscription = getMeta('ol-subscription')
      const { currency, taxRate } = subscription.recurly
      $scope.price = '...' // Placeholder while we talk to recurly
      RecurlyPricing.loadDisplayPriceWithTax(planCode, currency, taxRate).then(
        price => {
          $scope.price = price
        }
      )
    })
  }
)

App.controller(
  'ConfirmChangePlanController',
  function ($scope, $modalInstance, $http) {
    $scope.confirmChangePlan = function () {
      const body = {
        plan_code: $scope.plan.planCode,
        _csrf: window.csrfToken,
      }

      $scope.genericError = false
      $scope.inflight = true

      return $http
        .post(`${SUBSCRIPTION_URL}?origin=confirmChangePlan`, body)
        .then(() => location.reload())
        .catch(() => {
          $scope.genericError = true
          $scope.inflight = false
        })
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  }
)

App.controller(
  'CancelPendingPlanChangeController',
  function ($scope, $modalInstance, $http) {
    $scope.confirmCancelPendingPlanChange = function () {
      const body = {
        _csrf: window.csrfToken,
      }

      $scope.genericError = false
      $scope.inflight = true

      return $http
        .post('/user/subscription/cancel-pending', body)
        .then(() => location.reload())
        .catch(() => {
          $scope.genericError = true
          $scope.inflight = false
        })
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  }
)

App.controller(
  'LeaveGroupModalController',
  function ($scope, $modalInstance, $http) {
    $scope.confirmLeaveGroup = function () {
      $scope.inflight = true
      return $http({
        url: '/subscription/group/user',
        method: 'DELETE',
        params: {
          subscriptionId: $scope.subscriptionId,
          _csrf: window.csrfToken,
        },
      })
        .then(() => location.reload())
        .catch(() => console.log('something went wrong changing plan'))
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  }
)

App.controller('GroupMembershipController', function ($scope, $modal) {
  $scope.removeSelfFromGroup = function (subscriptionId) {
    $scope.subscriptionId = subscriptionId
    return $modal.open({
      templateUrl: 'LeaveGroupModalTemplate',
      controller: 'LeaveGroupModalController',
      scope: $scope,
    })
  }
})

App.controller('RecurlySubscriptionController', function ($scope) {
  const recurlyIsSetup = ensureRecurlyIsSetup()
  const subscription = getMeta('ol-subscription')
  $scope.showChangePlanButton = recurlyIsSetup && !subscription.groupPlan
  if (
    window.subscription.recurly.account.has_past_due_invoice &&
    window.subscription.recurly.account.has_past_due_invoice._ === 'true'
  ) {
    $scope.showChangePlanButton = false
  }
  $scope.recurlyLoadError = !recurlyIsSetup

  $scope.switchToDefaultView = () => {
    $scope.showCancellation = false
    $scope.showChangePlan = false
  }
  $scope.switchToDefaultView()

  $scope.switchToCancellationView = () => {
    $scope.showCancellation = true
    $scope.showChangePlan = false
  }

  $scope.switchToChangePlanView = () => {
    $scope.showCancellation = false
    $scope.showChangePlan = true
  }
})

App.controller(
  'RecurlyCancellationController',
  function ($scope, RecurlyPricing, $http) {
    if (!ensureRecurlyIsSetup()) return
    const subscription = getMeta('ol-subscription')
    const sevenDaysTime = new Date()
    sevenDaysTime.setDate(sevenDaysTime.getDate() + 7)
    const freeTrialEndDate = new Date(subscription.recurly.trial_ends_at)
    const freeTrialInFuture = freeTrialEndDate > new Date()
    const freeTrialExpiresUnderSevenDays = freeTrialEndDate < sevenDaysTime

    const isMonthlyCollab =
      subscription.plan.planCode.indexOf('collaborator') !== -1 &&
      subscription.plan.planCode.indexOf('ann') === -1 &&
      !subscription.groupPlan
    const stillInFreeTrial = freeTrialInFuture && freeTrialExpiresUnderSevenDays

    if (isMonthlyCollab && stillInFreeTrial) {
      $scope.showExtendFreeTrial = true
    } else if (isMonthlyCollab && !stillInFreeTrial) {
      $scope.showDowngradeToStudent = true
    } else {
      $scope.showBasicCancel = true
    }

    const { currency, taxRate } = subscription.recurly
    $scope.studentPrice = '...' // Placeholder while we talk to recurly
    RecurlyPricing.loadDisplayPriceWithTax('student', currency, taxRate).then(
      price => {
        $scope.studentPrice = price
      }
    )

    $scope.downgradeToStudent = function () {
      const body = {
        plan_code: 'student',
        _csrf: window.csrfToken,
      }
      $scope.inflight = true
      return $http
        .post(`${SUBSCRIPTION_URL}?origin=downgradeToStudent`, body)
        .then(() => location.reload())
        .catch(() => console.log('something went wrong changing plan'))
    }

    $scope.cancelSubscription = function () {
      const body = { _csrf: window.csrfToken }

      $scope.inflight = true
      return $http
        .post('/user/subscription/cancel', body)
        .then(() => (location.href = '/user/subscription/canceled'))
        .catch(() => console.log('something went wrong changing plan'))
    }

    $scope.extendTrial = function () {
      const body = { _csrf: window.csrfToken }
      $scope.inflight = true
      return $http
        .put('/user/subscription/extend', body)
        .then(() => location.reload())
        .catch(() => console.log('something went wrong changing plan'))
    }
  }
)
