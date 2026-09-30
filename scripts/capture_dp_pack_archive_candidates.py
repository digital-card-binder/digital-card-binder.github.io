from pathlib import Path
from io import BytesIO
from PIL import Image
from selenium import webdriver
from selenium.webdriver.common.by import By
import time

OUT=Path("assets/packs/candidates")
OUT.mkdir(parents=True, exist_ok=True)

TARGETS={
  "bs8":"https://file.namu.moe/file/8ae8b528101ede59c2e29eb72bd501d7353393e3d42859beb75499094b49d0d2",
  "bs9":"https://file.namu.moe/file/2e617578aaaa76b38065aba6f3f5d87d4cfd11616783fa8ca9cecffb3ac9e4f8",
  "bs10":"https://file.namu.moe/file/954b07d3b8603250dc2f03c02db853cc0b8f9accb0cd0db50bc3c2fef8d39508fa6689c612c7c7a615ed141f0e42c63d",
}

opts=webdriver.ChromeOptions()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1200,1800")
opts.add_argument("--lang=ko-KR")
driver=webdriver.Chrome(options=opts)
try:
    for code,url in TARGETS.items():
        driver.get(url)
        for _ in range(20):
            imgs=driver.find_elements(By.TAG_NAME,"img")
            if imgs:
                img=imgs[0]
                nw=driver.execute_script("return arguments[0].naturalWidth||0",img)
                nh=driver.execute_script("return arguments[0].naturalHeight||0",img)
                print(code,"DIRECT",nw,nh,driver.current_url)
                if nw>100 and nh>180:
                    png=img.screenshot_as_png
                    Image.open(BytesIO(png)).verify()
                    (OUT/f"{code}-namu.png").write_bytes(png)
                    print(code,"saved",len(png))
                    break
            time.sleep(1)
        else:
            raise RuntimeError(f"{code}: direct image did not load")
finally:
    driver.quit()
