import { withAuthHandler } from '../../utils/api'

export default withAuthHandler(async (_event, auth) => {
  return {
    code: 200,
    message: '登录有效',
    data: auth
  }
})
