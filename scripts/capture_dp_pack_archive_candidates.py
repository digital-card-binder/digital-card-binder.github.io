from pathlib import Path
from io import BytesIO
from PIL import Image
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
import time

OUT=Path("assets/packs/candidates")
OUT.mkdir(parents=True, exist_ok=True)

TARGETS={
  "bs8":("https://d.namu.moe/w/%ED%99%94%EB%A0%A4%ED%95%9C%20%EC%A0%84%EC%84%A4","화려한 전설.png"),
  "bs9":("https://d.namu.moe/w/%ED%98%B8%EC%88%98%EC%9D%98%20%EA%B8%B0%EC%A0%81","호수의 기적.png"),
  "bs10":("https://d.namu.moe/w/%EA%B3%A0%EB%8C%80%EC%9D%98%20%EC%88%98%ED%98%B8%EC%9E%90(%ED%8F%AC%EC%BC%93%EB%AA%AC%20%EC%B9%B4%EB%93%9C%20%EA%B2%8C%EC%9E%84)","고대의 수호자_포케카.png"),
}

opts=webdriver.ChromeOptions()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1400,2200")
opts.add_argument("--lang=ko-KR")
driver=webdriver.Chrome(options=opts)
try:
    for code,(url,altfrag) in TARGETS.items():
        driver.get(url)
        time.sleep(3)
        found=None
        for img in driver.find_elements(By.TAG_NAME,"img"):
            alt=img.get_attribute("alt") or ""
            src=img.get_attribute("currentSrc") or img.get_attribute("src") or ""
            nw=driver.execute_script("return arguments[0].naturalWidth||0",img)
            nh=driver.execute_script("return arguments[0].naturalHeight||0",img)
            if altfrag in alt:
                print(code,"MATCH",alt,nw,nh,src)
                if nw>100 and nh>180:
                    found=img
                    break
        if found is None:
            raise RuntimeError(f"{code}: target image not found")
        driver.execute_script("arguments[0].scrollIntoView({block:'center'})",found)
        time.sleep(1)
        png=found.screenshot_as_png
        Image.open(BytesIO(png)).verify()
        (OUT/f"{code}-namu.png").write_bytes(png)
        print(code,"saved",len(png))
finally:
    driver.quit()
