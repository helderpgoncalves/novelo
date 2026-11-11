import sys, glob
from PIL import Image
Q="/private/tmp/claude-501/-Users-hegs-Downloads-helder-novelo/74911992-2346-4c38-8462-c7bbcc5b986d/scratchpad/qa"
a,b=int(sys.argv[1]),int(sys.argv[2])
fs=sorted(glob.glob(Q+"/s-*.jpg"))[a-1:b]
ims=[Image.open(f) for f in fs]
w,h=ims[0].size
cols=2; rows=(len(ims)+1)//2
sh=Image.new("RGB",(cols*w,rows*h),"white")
for i,im in enumerate(ims): sh.paste(im,((i%cols)*w,(i//cols)*h))
out=f"{Q}/sheet-{a}-{b}.png"; sh.save(out); print(out)
