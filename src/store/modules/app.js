import Cookies from 'js-cookie'

const useAppStore = defineStore(
  'app',
  {
    state: () => ({
      sidebar: {
        // 修改初始状态为 false，表示侧边栏默认折叠
        opened: Cookies.get('sidebarStatus') ? !!+Cookies.get('sidebarStatus') : false,
        withoutAnimation: false,
        hide: false
      },
      device: 'desktop',
      size: Cookies.get('size') || 'default'
    }),
    actions: {
      toggleSideBar(withoutAnimation) {
        if (this.sidebar.hide) {
          return false
        }
        this.sidebar.opened = !this.sidebar.opened
        this.sidebar.withoutAnimation = withoutAnimation
        if (this.sidebar.opened) {
          Cookies.set('sidebarStatus', 1)
        } else {
          Cookies.set('sidebarStatus', 0)
        }
      },
      closeSideBar({ withoutAnimation }) {
        Cookies.set('sidebarStatus', 0)
        this.sidebar.opened = false
        this.sidebar.withoutAnimation = withoutAnimation
      },
      toggleDevice(device) {
        this.device = device
      },
      setSize(size) {
        this.size = size
        Cookies.set('size', size)
      },
      toggleSideBarHide(status) {
        this.sidebar.hide = status
      }
    }
  })

export default useAppStore
