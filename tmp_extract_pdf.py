from pathlib import Path
import shutil

source = next(Path(r"D:\Edgedownload").glob("MapGIS*.pdf"))
target = Path(r"D:\pythonProject\shihua_showcase\mapgis_leaflet_manual.pdf")
shutil.copyfile(source, target)
print(source)
print(target.stat().st_size)
