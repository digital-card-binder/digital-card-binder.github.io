"use strict";

(function () {
  function syncArCountLabels() {
    const arLink = document.querySelector('a.collection-link[href="./ar.html"]');
    const subtitle = arLink?.querySelector("small");
    if (subtitle) subtitle.textContent = "SV · M · 510 CARDS";
  }

  syncArCountLabels();
})();
