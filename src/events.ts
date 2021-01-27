import { openAlert, AlertButton, AlertConfig, closeAlerts } from './ui/alert/Alert'
import { closeToast, openToast } from './ui/toast/Toast'
import { ExtendedP2PPairingResponse } from './types/P2PPairingResponse'
import { PostMessagePairingRequest } from './types/PostMessagePairingRequest'
import { ExtendedPostMessagePairingResponse } from './types/PostMessagePairingResponse'
import { BlockExplorer } from './utils/block-explorer'
import { Logger } from './utils/Logger'
import { Serializer } from './Serializer'
import { shortenString } from './utils/shorten-string'
import {
  P2PPairingRequest,
  AccountInfo,
  ErrorResponse,
  UnknownBeaconError,
  PermissionResponseOutput,
  OperationResponseOutput,
  BroadcastResponseOutput,
  SignPayloadResponseOutput,
  Network,
  BeaconError,
  ConnectionContext,
  Transport,
  NetworkType,
  AcknowledgeResponse
} from '.'

const logger = new Logger('BeaconEvents')
const serializer = new Serializer()

const SUCCESS_TIMER: number = 5 * 1000

const SVG_EXTERNAL: string = `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="external-link-alt" class="svg-inline--fa fa-external-link-alt fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M432,320H400a16,16,0,0,0-16,16V448H64V128H208a16,16,0,0,0,16-16V80a16,16,0,0,0-16-16H48A48,48,0,0,0,0,112V464a48,48,0,0,0,48,48H400a48,48,0,0,0,48-48V336A16,16,0,0,0,432,320ZM488,0h-128c-21.37,0-32.05,25.91-17,41l35.73,35.73L135,320.37a24,24,0,0,0,0,34L157.67,377a24,24,0,0,0,34,0L435.28,133.32,471,169c15,15,41,4.5,41-17V24A24,24,0,0,0,488,0Z"></path></svg>`

/**
 * The different events that can be emitted by the beacon-sdk
 */
export enum BeaconEvent {
  PERMISSION_REQUEST_SENT = 'PERMISSION_REQUEST_SENT',
  PERMISSION_REQUEST_SUCCESS = 'PERMISSION_REQUEST_SUCCESS',
  PERMISSION_REQUEST_ERROR = 'PERMISSION_REQUEST_ERROR',
  OPERATION_REQUEST_SENT = 'OPERATION_REQUEST_SENT',
  OPERATION_REQUEST_SUCCESS = 'OPERATION_REQUEST_SUCCESS',
  OPERATION_REQUEST_ERROR = 'OPERATION_REQUEST_ERROR',
  SIGN_REQUEST_SENT = 'SIGN_REQUEST_SENT',
  SIGN_REQUEST_SUCCESS = 'SIGN_REQUEST_SUCCESS',
  SIGN_REQUEST_ERROR = 'SIGN_REQUEST_ERROR',
  BROADCAST_REQUEST_SENT = 'BROADCAST_REQUEST_SENT',
  BROADCAST_REQUEST_SUCCESS = 'BROADCAST_REQUEST_SUCCESS',
  BROADCAST_REQUEST_ERROR = 'BROADCAST_REQUEST_ERROR',

  ACKNOWLEDGE_RECEIVED = 'ACKNOWLEDGE_RECEIVED',

  LOCAL_RATE_LIMIT_REACHED = 'LOCAL_RATE_LIMIT_REACHED',

  NO_PERMISSIONS = 'NO_PERMISSIONS',

  ACTIVE_ACCOUNT_SET = 'ACTIVE_ACCOUNT_SET',

  ACTIVE_TRANSPORT_SET = 'ACTIVE_TRANSPORT_SET',

  PAIR_INIT = 'PAIR_INIT',
  PAIR_SUCCESS = 'PAIR_SUCCESS',
  CHANNEL_CLOSED = 'CHANNEL_CLOSED',

  P2P_CHANNEL_CONNECT_SUCCESS = 'P2P_CHANNEL_CONNECT_SUCCESS',
  P2P_LISTEN_FOR_CHANNEL_OPEN = 'P2P_LISTEN_FOR_CHANNEL_OPEN',

  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export interface RequestSentInfo {
  walletName: string
  walletIcon?: string
  resetCallback(): Promise<void>
}

/**
 * The type of the payload of the different BeaconEvents
 */
export interface BeaconEventType {
  [BeaconEvent.PERMISSION_REQUEST_SENT]: RequestSentInfo
  [BeaconEvent.PERMISSION_REQUEST_SUCCESS]: {
    account: AccountInfo
    output: PermissionResponseOutput
    blockExplorer: BlockExplorer
    connectionContext: ConnectionContext
  }
  [BeaconEvent.PERMISSION_REQUEST_ERROR]: ErrorResponse
  [BeaconEvent.OPERATION_REQUEST_SENT]: RequestSentInfo
  [BeaconEvent.OPERATION_REQUEST_SUCCESS]: {
    account: AccountInfo
    output: OperationResponseOutput
    blockExplorer: BlockExplorer
    connectionContext: ConnectionContext
  }
  [BeaconEvent.OPERATION_REQUEST_ERROR]: ErrorResponse
  [BeaconEvent.SIGN_REQUEST_SENT]: RequestSentInfo
  [BeaconEvent.SIGN_REQUEST_SUCCESS]: {
    output: SignPayloadResponseOutput
    connectionContext: ConnectionContext
  }
  [BeaconEvent.SIGN_REQUEST_ERROR]: ErrorResponse
  [BeaconEvent.BROADCAST_REQUEST_SENT]: RequestSentInfo
  [BeaconEvent.BROADCAST_REQUEST_SUCCESS]: {
    network: Network
    output: BroadcastResponseOutput
    blockExplorer: BlockExplorer
    connectionContext: ConnectionContext
  }
  [BeaconEvent.BROADCAST_REQUEST_ERROR]: ErrorResponse
  [BeaconEvent.ACKNOWLEDGE_RECEIVED]: AcknowledgeResponse
  [BeaconEvent.LOCAL_RATE_LIMIT_REACHED]: undefined
  [BeaconEvent.NO_PERMISSIONS]: undefined
  [BeaconEvent.ACTIVE_ACCOUNT_SET]: AccountInfo
  [BeaconEvent.ACTIVE_TRANSPORT_SET]: Transport
  [BeaconEvent.PAIR_INIT]: {
    p2pPeerInfo: P2PPairingRequest
    postmessagePeerInfo: PostMessagePairingRequest
    preferredNetwork: NetworkType
    abortedHandler?(): void
  }
  [BeaconEvent.PAIR_SUCCESS]: ExtendedPostMessagePairingResponse | ExtendedP2PPairingResponse
  [BeaconEvent.P2P_CHANNEL_CONNECT_SUCCESS]: P2PPairingRequest
  [BeaconEvent.P2P_LISTEN_FOR_CHANNEL_OPEN]: P2PPairingRequest
  [BeaconEvent.CHANNEL_CLOSED]: string
  [BeaconEvent.INTERNAL_ERROR]: string
  [BeaconEvent.UNKNOWN]: undefined
}

/**
 * Show a "Request sent" toast
 */
const showSentToast = async (requestSentInfo: RequestSentInfo): Promise<void> => {
  openToast({
    body: `Request sent to&nbsp;{{wallet}}`,
    requestSentInfo,
    forceNew: true,
    state: 'loading',
    actions: [
      {
        text: 'Did you make a mistake?',
        actionText: 'Cancel Request',
        actionCallback: async (): Promise<void> => {
          await closeToast()
        }
      },
      {
        text: 'Wallet not receiving request?',
        actionText: 'Reset Connection',
        actionCallback: async (): Promise<void> => {
          await closeToast()
          // eslint-disable-next-line @typescript-eslint/unbound-method
          const resetCallback = requestSentInfo.resetCallback
          if (resetCallback) {
            logger.log('showSentToast', 'resetCallback invoked')
            await resetCallback()
          }
        }
      }
    ]
  }).catch((toastError) => console.error(toastError))
}

const showAcknowledgedToast = async (_message: AcknowledgeResponse): Promise<void> => {
  openToast({
    body: 'Awaiting confirmation in&nbsp;{{wallet}}'
  }).catch((toastError) => console.error(toastError))
}

/**
 * Show a "No Permission" alert
 */
const showNoPermissionAlert = async (): Promise<void> => {
  await openAlert({
    title: 'No Permission',
    body: 'Please allow the wallet to handle this type of request.'
  })
}

/**
 * Show an error alert
 *
 * @param beaconError The beacon error
 */
const showErrorAlert = async (
  beaconError: ErrorResponse,
  buttons?: AlertButton[]
): Promise<void> => {
  const error = beaconError.errorType
    ? BeaconError.getError(beaconError.errorType, beaconError.errorData)
    : new UnknownBeaconError()

  await closeToast()

  await openAlert({
    title: error.title,
    body: error.description,
    buttons
  })
}

/**
 * Show a rate limit reached toast
 */
const showRateLimitReached = async (): Promise<void> => {
  openAlert({
    title: 'Error',
    body: 'Rate limit reached. Please slow down',
    buttons: [{ text: 'Done', style: 'outline' }],
    timer: 3000
  }).catch((toastError) => console.error(toastError))
}

/**
 * Show a "connection successful" alert for 1.5 seconds
 */
const showBeaconConnectedAlert = async (): Promise<void> => {
  await openAlert({
    title: 'Success',
    body: 'A wallet has been paired over the beacon network.',
    buttons: [{ text: 'Done', style: 'outline' }],
    timer: 1500
  })
}

/**
 * Show a "connection successful" alert for 1.5 seconds
 */
const showExtensionConnectedAlert = async (): Promise<void> => {
  await closeAlerts()
  // await openAlert({
  //   title: 'Success',
  //   body: 'A wallet has been paired.',
  //   buttons: [{ text: 'Done', style: 'outline' }],
  //   timer: 1500
  // })
}

/**
 * Show a "channel closed" alert for 1.5 seconds
 */
const showChannelClosedAlert = async (): Promise<void> => {
  await openAlert({
    title: 'Channel closed',
    body: `Your peer has closed the connection.`,
    buttons: [{ text: 'Done', style: 'outline' }],
    timer: 1500
  })
}

const showInternalErrorAlert = async (
  data: BeaconEventType[BeaconEvent.INTERNAL_ERROR]
): Promise<void> => {
  const alertConfig: AlertConfig = {
    title: 'Internal Error',
    body: `${data}`,
    buttons: [{ text: 'Done', style: 'outline' }]
  }
  await openAlert(alertConfig)
}

/**
 * Show a connect alert with QR code
 *
 * @param data The data that is emitted by the P2P_LISTEN_FOR_CHANNEL_OPEN event
 */
const showQrAlert = async (
  data: BeaconEventType[BeaconEvent.P2P_LISTEN_FOR_CHANNEL_OPEN]
): Promise<void> => {
  const dataString = JSON.stringify(data)
  console.log(dataString) // TODO: Remove after "copy to clipboard" has been added.

  const base58encoded = await serializer.serialize(data)
  console.log(base58encoded) // TODO: Remove after "copy to clipboard" has been added.

  const alertConfig: AlertConfig = {
    title: 'Choose your preferred wallet',
    body: `<p></p>`,
    pairingPayload: {
      p2pSyncCode: base58encoded,
      postmessageSyncCode: base58encoded,
      preferredNetwork: NetworkType.MAINNET
    }
  }
  await openAlert(alertConfig)
}

/**
 * Show a connect alert with QR code
 *
 * @param data The data that is emitted by the PAIR_INIT event
 */
const showPairAlert = async (data: BeaconEventType[BeaconEvent.PAIR_INIT]): Promise<void> => {
  const p2pBase58encoded = await serializer.serialize(data.p2pPeerInfo)
  const postmessageBase58encoded = await serializer.serialize(data.postmessagePeerInfo)

  const alertConfig: AlertConfig = {
    title: 'Choose your preferred wallet',
    body: `<p></p>`,
    pairingPayload: {
      p2pSyncCode: p2pBase58encoded,
      postmessageSyncCode: postmessageBase58encoded,
      preferredNetwork: data.preferredNetwork
    },
    // eslint-disable-next-line @typescript-eslint/unbound-method
    closeButtonCallback: data.abortedHandler
  }
  await openAlert(alertConfig)
}

/**
 * Show a "Permission Granted" alert
 *
 * @param data The data that is emitted by the PERMISSION_REQUEST_SUCCESS event
 */
const showPermissionSuccessAlert = async (
  data: BeaconEventType[BeaconEvent.PERMISSION_REQUEST_SUCCESS]
): Promise<void> => {
  const { output } = data

  await openToast({
    body: `{{wallet}}&nbsp;has granted permission`,
    timer: SUCCESS_TIMER,
    state: 'finished',
    actions: [
      {
        text: 'Address',
        actionText: `<strong>${shortenString(output.address)}</strong>`
      },
      {
        text: 'Network',
        actionText: `${output.network.type}`
      },
      {
        text: 'Permissions',
        actionText: output.scopes.join(', ')
      }
    ]
  })
}

/**
 * Show an "Operation Broadcasted" alert
 *
 * @param data The data that is emitted by the OPERATION_REQUEST_SUCCESS event
 */
const showOperationSuccessAlert = async (
  data: BeaconEventType[BeaconEvent.OPERATION_REQUEST_SUCCESS]
): Promise<void> => {
  const { account, output, blockExplorer } = data

  await openToast({
    body: `{{wallet}}&nbsp;successfully submitted operation`,
    timer: SUCCESS_TIMER,
    state: 'finished',
    actions: [
      {
        text: `<strong>${shortenString(output.transactionHash)}</strong>`,
        actionText: `Open Blockexplorer ${SVG_EXTERNAL}`,
        actionCallback: async (): Promise<void> => {
          const link: string = await blockExplorer.getTransactionLink(
            output.transactionHash,
            account.network
          )
          window.open(link, '_blank')
          await closeToast()
        }
      }
    ]
  })
}

/**
 * Show a "Transaction Signed" alert
 *
 * @param data The data that is emitted by the SIGN_REQUEST_SUCCESS event
 */
const showSignSuccessAlert = async (
  data: BeaconEventType[BeaconEvent.SIGN_REQUEST_SUCCESS]
): Promise<void> => {
  const output = data.output
  await openToast({
    body: `{{wallet}}&nbsp;successfully signed payload`,
    timer: SUCCESS_TIMER,
    state: 'finished',
    actions: [
      {
        text: `Signature: <strong>${shortenString(output.signature)}</strong>`,
        actionText: 'Copy to clipboard',
        actionCallback: async (): Promise<void> => {
          navigator.clipboard.writeText(output.signature).then(
            () => {
              console.log('Copying to clipboard was successful!')
            },
            (err) => {
              console.error('Could not copy text to clipboard: ', err)
            }
          )
          await closeToast()
        }
      }
    ]
  })
}

/**
 * Show a "Broadcasted" alert
 *
 * @param data The data that is emitted by the BROADCAST_REQUEST_SUCCESS event
 */
const showBroadcastSuccessAlert = async (
  data: BeaconEventType[BeaconEvent.BROADCAST_REQUEST_SUCCESS]
): Promise<void> => {
  const { network, output, blockExplorer } = data

  await openToast({
    body: `{{wallet}}&nbsp;successfully injected operation`,
    timer: SUCCESS_TIMER,
    state: 'finished',
    actions: [
      {
        text: `<strong>${shortenString(output.transactionHash)}</strong>`,
        actionText: `Open Blockexplorer ${SVG_EXTERNAL}`,
        actionCallback: async (): Promise<void> => {
          const link: string = await blockExplorer.getTransactionLink(
            output.transactionHash,
            network
          )
          window.open(link, '_blank')
          await closeToast()
        }
      }
    ]
  })
}

const emptyHandler = (): BeaconEventHandlerFunction => async (): Promise<void> => {
  //
}

export type BeaconEventHandlerFunction<T = unknown> = (
  data: T,
  eventCallback?: AlertButton[]
) => void | Promise<void>

/**
 * The default event handlers
 */
export const defaultEventCallbacks: {
  [key in BeaconEvent]: BeaconEventHandlerFunction<BeaconEventType[key]>
} = {
  [BeaconEvent.PERMISSION_REQUEST_SENT]: showSentToast,
  [BeaconEvent.PERMISSION_REQUEST_SUCCESS]: showPermissionSuccessAlert,
  [BeaconEvent.PERMISSION_REQUEST_ERROR]: showErrorAlert,
  [BeaconEvent.OPERATION_REQUEST_SENT]: showSentToast,
  [BeaconEvent.OPERATION_REQUEST_SUCCESS]: showOperationSuccessAlert,
  [BeaconEvent.OPERATION_REQUEST_ERROR]: showErrorAlert,
  [BeaconEvent.SIGN_REQUEST_SENT]: showSentToast,
  [BeaconEvent.SIGN_REQUEST_SUCCESS]: showSignSuccessAlert,
  [BeaconEvent.SIGN_REQUEST_ERROR]: showErrorAlert,
  [BeaconEvent.BROADCAST_REQUEST_SENT]: showSentToast,
  [BeaconEvent.BROADCAST_REQUEST_SUCCESS]: showBroadcastSuccessAlert,
  [BeaconEvent.BROADCAST_REQUEST_ERROR]: showErrorAlert,
  [BeaconEvent.ACKNOWLEDGE_RECEIVED]: showAcknowledgedToast,
  [BeaconEvent.LOCAL_RATE_LIMIT_REACHED]: showRateLimitReached,
  [BeaconEvent.NO_PERMISSIONS]: showNoPermissionAlert,
  [BeaconEvent.ACTIVE_ACCOUNT_SET]: emptyHandler(),
  [BeaconEvent.ACTIVE_TRANSPORT_SET]: emptyHandler(),
  [BeaconEvent.PAIR_INIT]: showPairAlert,
  [BeaconEvent.PAIR_SUCCESS]: showExtensionConnectedAlert,
  [BeaconEvent.P2P_CHANNEL_CONNECT_SUCCESS]: showBeaconConnectedAlert,
  [BeaconEvent.P2P_LISTEN_FOR_CHANNEL_OPEN]: showQrAlert,
  [BeaconEvent.CHANNEL_CLOSED]: showChannelClosedAlert,
  [BeaconEvent.INTERNAL_ERROR]: showInternalErrorAlert,
  [BeaconEvent.UNKNOWN]: emptyHandler()
}

/**
 * Handles beacon events
 */
export class BeaconEventHandler {
  private readonly callbackMap: {
    [key in BeaconEvent]: BeaconEventHandlerFunction<any>[] // TODO: Fix type
  } = {
    [BeaconEvent.PERMISSION_REQUEST_SENT]: [defaultEventCallbacks.PERMISSION_REQUEST_SENT],
    [BeaconEvent.PERMISSION_REQUEST_SUCCESS]: [defaultEventCallbacks.PERMISSION_REQUEST_SUCCESS],
    [BeaconEvent.PERMISSION_REQUEST_ERROR]: [defaultEventCallbacks.PERMISSION_REQUEST_ERROR],
    [BeaconEvent.OPERATION_REQUEST_SENT]: [defaultEventCallbacks.OPERATION_REQUEST_SENT],
    [BeaconEvent.OPERATION_REQUEST_SUCCESS]: [defaultEventCallbacks.OPERATION_REQUEST_SUCCESS],
    [BeaconEvent.OPERATION_REQUEST_ERROR]: [defaultEventCallbacks.OPERATION_REQUEST_ERROR],
    [BeaconEvent.SIGN_REQUEST_SENT]: [defaultEventCallbacks.SIGN_REQUEST_SENT],
    [BeaconEvent.SIGN_REQUEST_SUCCESS]: [defaultEventCallbacks.SIGN_REQUEST_SUCCESS],
    [BeaconEvent.SIGN_REQUEST_ERROR]: [defaultEventCallbacks.SIGN_REQUEST_ERROR],
    [BeaconEvent.BROADCAST_REQUEST_SENT]: [defaultEventCallbacks.BROADCAST_REQUEST_SENT],
    [BeaconEvent.BROADCAST_REQUEST_SUCCESS]: [defaultEventCallbacks.BROADCAST_REQUEST_SUCCESS],
    [BeaconEvent.BROADCAST_REQUEST_ERROR]: [defaultEventCallbacks.BROADCAST_REQUEST_ERROR],
    [BeaconEvent.ACKNOWLEDGE_RECEIVED]: [defaultEventCallbacks.ACKNOWLEDGE_RECEIVED],
    [BeaconEvent.LOCAL_RATE_LIMIT_REACHED]: [defaultEventCallbacks.LOCAL_RATE_LIMIT_REACHED],
    [BeaconEvent.NO_PERMISSIONS]: [defaultEventCallbacks.NO_PERMISSIONS],
    [BeaconEvent.ACTIVE_ACCOUNT_SET]: [defaultEventCallbacks.ACTIVE_ACCOUNT_SET],
    [BeaconEvent.ACTIVE_TRANSPORT_SET]: [defaultEventCallbacks.ACTIVE_TRANSPORT_SET],
    [BeaconEvent.PAIR_INIT]: [defaultEventCallbacks.PAIR_INIT],
    [BeaconEvent.PAIR_SUCCESS]: [defaultEventCallbacks.PAIR_SUCCESS],
    [BeaconEvent.P2P_CHANNEL_CONNECT_SUCCESS]: [defaultEventCallbacks.P2P_CHANNEL_CONNECT_SUCCESS],
    [BeaconEvent.P2P_LISTEN_FOR_CHANNEL_OPEN]: [defaultEventCallbacks.P2P_LISTEN_FOR_CHANNEL_OPEN],
    [BeaconEvent.CHANNEL_CLOSED]: [defaultEventCallbacks.CHANNEL_CLOSED],
    [BeaconEvent.INTERNAL_ERROR]: [defaultEventCallbacks.INTERNAL_ERROR],
    [BeaconEvent.UNKNOWN]: [defaultEventCallbacks.UNKNOWN]
  }

  constructor(
    eventsToOverride: {
      [key in BeaconEvent]?: {
        handler: BeaconEventHandlerFunction<BeaconEventType[key]>
      }
    } = {},
    overrideAll?: boolean
  ) {
    if (overrideAll) {
      this.setAllHandlers()
    }
    this.overrideDefaults(eventsToOverride)
  }

  /**
   * A method to subscribe to a specific beacon event and register a callback
   *
   * @param event The event being emitted
   * @param eventCallback The callback that will be invoked
   */
  public async on<K extends BeaconEvent>(
    event: K,
    eventCallback: BeaconEventHandlerFunction<BeaconEventType[K]>
  ): Promise<void> {
    const listeners = this.callbackMap[event] || []
    listeners.push(eventCallback)
    this.callbackMap[event] = listeners
  }

  /**
   * Emit a beacon event
   *
   * @param event The event being emitted
   * @param data The data to be emit
   */
  public async emit<K extends BeaconEvent>(
    event: K,
    data?: BeaconEventType[K],
    eventCallback?: AlertButton[]
  ): Promise<void> {
    const listeners = this.callbackMap[event]
    if (listeners && listeners.length > 0) {
      listeners.forEach(async (listener: BeaconEventHandlerFunction) => {
        try {
          await listener(data, eventCallback)
        } catch (listenerError) {
          logger.error(`error handling event ${event}`, listenerError)
        }
      })
    }
  }

  /**
   * Override beacon event default callbacks. This can be used to disable default alert/toast behaviour
   *
   * @param eventsToOverride An object with the events to override
   */
  private overrideDefaults(
    eventsToOverride: {
      [key in BeaconEvent]?: {
        handler: BeaconEventHandlerFunction<BeaconEventType[key]>
      }
    }
  ): void {
    Object.keys(eventsToOverride).forEach((untypedEvent: string) => {
      const eventType: BeaconEvent = untypedEvent as BeaconEvent
      const event = eventsToOverride[eventType]
      if (event) {
        this.callbackMap[eventType] = [event.handler]
      }
    })
  }

  /**
   * Set all event callbacks to a specific handler.
   */
  private setAllHandlers(handler?: BeaconEventHandlerFunction): void {
    Object.keys(this.callbackMap).forEach((untypedEvent: string) => {
      const eventType: BeaconEvent = untypedEvent as BeaconEvent
      this.callbackMap[eventType] = []
      if (handler) {
        this.callbackMap[eventType].push(handler)
      } else {
        this.callbackMap[eventType].push((...data) => {
          logger.log(untypedEvent, ...data)
        })
      }
    })
  }
}
