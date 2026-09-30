from pathlib import Path
from io import BytesIO
from PIL import Image
from selenium import webdriver
from selenium.webdriver.common.by import By
import time

OUT=Path("assets/packs/candidates")
OUT.mkdir(parents=True, exist_ok=True)

items={"bs9":"432817025"}

opts=webdriver.ChromeOptions()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1400,2200")
opts.add_argument("--lang=ko-KR")
driver=webdriver.Chrome(options=opts)
try:
    for code,pid in items.items():
        url=f"https://m.bunjang.co.kr/products/{pid}"
        driver.get(url)
        time.sleep(5)
        candidates=[]
        for img in driver.find_elements(By.TAG_NAME,"img"):
            src=img.get_attribute("currentSrc") or img.get_attribute("src") or ""
            alt=img.get_attribute("alt") or ""
            try:
                nw=driver.execute_script("return arguments[0].naturalWidth||0",img)
                nh=driver.execute_script("return arguments[0].naturalHeight||0",img)
            except Exception:
                nw=nh=0
            if pid in src or "product/" in src:
                candidates.append((nw*nh,nw,nh,src,alt,img))
        candidates.sort(key=lambda x:x[0],reverse=True)
        if not candidates:
            raise RuntimeError(f"{code}: no product images on {url}")
        area,nw,nh,src,alt,img=candidates[0]
        print(code,"PICK",nw,nh,src,alt)
        driver.execute_script("arguments[0].scrollIntoView({block:'center'})",img)
        time.sleep(1)
        png=img.screenshot_as_png
        Image.open(BytesIO(png)).verify()
        (OUT/f"{code}-bunjang-{pid}.png").write_bytes(png)
        print(code,"saved",len(png))
finally:
    driver.quit()
