function toggleSideBar(id) {
  var _dom = document.getElementById(id)
  _dom.style.display = _dom.style.display === 'block' ? 'none' : 'block'
}

function showSideBar(id) {
  var _dom = document.getElementById(id)
  _dom.style.display = 'block'
}

var lastClickClassId
function highLightClickClass(currentId) {
  var _dom2 = document.getElementById(currentId)
  _dom2.style.color = '#ffa83df5'
  _dom2.style.fontWeight="900"
  if (lastClickClassId && lastClickClassId !== currentId) {
    var _dom3 = document.getElementById(lastClickClassId)
    _dom3.style.color = '#798897'
    _dom3.style.fontWeight="400"
  }
  lastClickClassId = currentId
}

var lastClickClassTarget
function highLightClickClassByTarget(target) {
  target.style.color = '#ffa83df5'
  target.style.fontWeight="900"
  if (lastClickClassTarget && lastClickClassTarget.getAttribute('title') !== target.getAttribute('title')) {
    lastClickClassTarget.style.color = '#798897'
    lastClickClassTarget.style.fontWeight="400"
  }
  lastClickClassTarget = target
}

function toggleLinkDetail(id) {
  var _dom = document.getElementById(id)
  var _arrow = document.getElementById(id + '-arrow')
  _arrow.style.transform = _dom.style.display === 'block' ? 'rotate(360deg)' : 'rotate(180deg)'
  _dom.style.display = _dom.style.display === 'block' ? 'none' : 'block'
  if (_dom.style.display === 'block') {
    highLightClickClass(id.split('-')[0])
  }
}

function showLinkDetail(id) {
  var _dom = document.getElementById(id)
  var _arrow = document.getElementById(id + '-arrow')
  _arrow.style.transform = 'rotate(360deg)'
  _dom.style.display = 'block'
}

function getTypeHTML(e) {
  var link = e.target.getAttribute('link')
  var goto = e.target.getAttribute('goto')
  const attributes = e.target.attributes
  for (let i = 0; i < attributes.length; i++) {
    const { name } =  attributes[i]
    if (name.indexOf('global.html') > -1) {
      goto = link.split('.')[0]
      link = 'global.html'
      break
    }
  }
  const _baseUrl = window.location.href.split('#')[0]
  fetch(_baseUrl + '/' + link, {
    method: 'GET',
  })
    .then(response => response.text())
    .then(data => {
      const _contentDom = document.getElementById('main-content')
      if (_contentDom) {
        _contentDom.innerHTML = data
        gotoTop(goto, getLinkName(link))
      }
    })
    .catch(error => console.error('Error:', error))
}

function gotoTop(id, linkName) {
  id = id || 'main-content'
  const _aDom = document.createElement('a');
  _aDom.href = '#' + id
  _aDom.click()
  if (linkName) {
    window.location.hash = id + '?' + linkName
  }
}

function getBaseUrl(url) {
  const regex1 = /^(http:|https:)\/\/[0-9a-zA-Z.]+:[0-9]+/
  const regex2 = /^(http:|https:)\/\/[0-9a-zA-Z.]+/
  let match = url.match(regex1)
  if (match && match[0]) {
    return match[0]
  } else {
    match = url.match(regex2)
    if (match && match[0]) {
      return match[0]
    }
  }
  return ''
}

function getLinkName(url) {
  var urlParts = url.split('/')
  return urlParts[urlParts.length - 1].split('.')[0]
}

(function() {
  const targets = [ ...document.querySelectorAll('#sidebarNav li.mapgis-link a')]
  targets.forEach(function (_target) {
    _target.addEventListener('click', function (e) {
      const _baseUrl = getBaseUrl(window.location.href)
      let isGlobe = false, globePath
      for (let i = 0; i < e.target.attributes.length; i++) {
        if(e.target.attributes[i].name.indexOf('global.html') > -1) {
          isGlobe = true
          globePath = e.target.attributes[i].name
          break
        }
      }
      let path
      if (isGlobe) {
        path = '/' + globePath
      } else {
        path = e.target.attributes[1].value
      }
      fetch(_baseUrl + path, {
        method: 'GET',
      })
        .then(response => response.text())
        .then(data => {
          const _contentDom = document.getElementById('main-content')
          if (_contentDom) {
            _contentDom.innerHTML = data
            var linkName = getLinkName(e.target.getAttribute('link'))
            highLightClickClass(linkName)
            gotoTop(undefined, linkName)
          }
        })
        .catch(error => console.error('Error:', error))
    })
  })
  const targets2 = [ ...document.querySelectorAll('#sidebarNav div div a#api-fold')]
  targets2.forEach(function (_target) {
    _target.addEventListener('click', function (e) {
      const _baseUrl = getBaseUrl(window.location.href)
      fetch(_baseUrl + e.target.attributes[1].value, {
        method: 'GET',
      })
        .then(response => response.text())
        .then(data => {
          const _contentDom = document.getElementById('main-content')
          if (_contentDom) {
            _contentDom.innerHTML = data
            gotoTop(e.target.getAttribute('linkto').split('#')[1], getLinkName(e.target.getAttribute('link')))
          }
        })
        .catch(error => console.error('Error:', error))
    })
  })

  const targets3 = [ ...document.querySelectorAll('#sidebarNav div div ul li a#api-member')]
  targets3.forEach(function (_target) {
    _target.addEventListener('click', function (e) {
      highLightClickClassByTarget(e.target)
      const _baseUrl = getBaseUrl(window.location.href)
      fetch(_baseUrl + e.target.attributes[1].value, {
        method: 'GET',
      })
        .then(response => response.text())
        .then(data => {
          const _contentDom = document.getElementById('main-content')
          if (_contentDom) {
            _contentDom.innerHTML = data
            gotoTop(e.target.getAttribute('title'), getLinkName(e.target.getAttribute('link')))
          }
        })
        .catch(error => console.error('Error:', error))
    })
  })
})()

window.onload = function () {
  var urlParts = window.location.href.split('#')
  if (urlParts.length > 1) {
    var id = urlParts[1].split('?')[0]
    var linkName = urlParts[1].split('?')[1]
    if (id && linkName) {
      const _baseUrl = window.location.href.split('/index.html')[0]
      fetch(_baseUrl + '/' + linkName + '.html', {
        method: 'GET',
      })
        .then(response => response.text())
        .then(data => {
          const _contentDom = document.getElementById('main-content')
          if (_contentDom) {
            _contentDom.innerHTML = data
            var modules = document.getElementsByClassName('mapgis-sidebar-menus')
            for (var i = 0; i < modules.length; i++) {
              if (modules[i].innerHTML.indexOf('"' + linkName + '"') > -1) {
                showSideBar(modules[i].id)
                var classArray = document.getElementsByClassName("mapgis-link-detail")
                for (var j = 0; j < classArray.length; j++) {
                  if (
                    classArray[j].id === linkName + '-detail'
                  ) {
                    showLinkDetail(linkName + '-detail')
                    highLightClickClass(linkName)
                    var members = document.querySelectorAll('#' + linkName + '-detail' + ' a')
                    for (var k = 0; k < members.length; k++) {
                      if (members[k].title === id) {
                        highLightClickClassByTarget(members[k])
                      }
                    }
                    break
                  }
                }
                break
              }
            }
            gotoTop(id, linkName)
          }
        })
        .catch(error => console.error('Error:', error))
    }
  }
}
