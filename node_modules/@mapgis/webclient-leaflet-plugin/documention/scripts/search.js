(function() {
  const input = document.querySelector('#search')
  const targets = [ ...document.querySelectorAll('#sidebarNav li')]
  input.addEventListener('input', () => {
    // loop over each targets and hide the not corresponding ones
    targets.forEach(target => {
      //判断名称
      let isHide = !target.innerText.toLowerCase().includes(input.value.toLowerCase());
      //判断详细说明
      if(isHide) {
        isHide = target.innerHTML.indexOf(input.value) < 0;
      }
      if (isHide) {
        target.style.display = 'none'
      } else {
        target.style.display = 'block'
      }
    })
  })
})()
