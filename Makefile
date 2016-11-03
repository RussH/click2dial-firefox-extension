
VER=`cat install.rdf |grep "em:version="|awk -F'"' '{print $$2}'`
TRDIR=../trunk-translation/pot

LANGS=bg de et fr it mn ru sl tr

.PHONY: pot lang

asterisk-ext: clean build-dir asterisk-ext-jar
	rm -f asterisk-ext-${VER}.xpi
	cd build/asterisk-ext ; zip -r ../../asterisk-ext-${VER}.xpi .
#	rm -f asterisk-ext-${VER}.xpi.asc
#	gpg --armor --sign --detach-sig asterisk-ext-${VER}.xpi

pot:
	moz2po -P chrome/locale/en-US/asterisk-ext.dtd pot/asterisk-ext.dtd/
	moz2po -P chrome/locale/en-US/asterisk-ext.properties pot/asterisk-ext.properties/

asterisk-ext-jar: lang
	rsync -av --delete --exclude-from=excluded.files . build/asterisk-ext/
	mkdir -p build/content/asterisk-ext
	rsync -av --delete --exclude-from=excluded-build.files chrome/content/ build/content/asterisk-ext/
	mkdir -p build/skin/classic/asterisk-ext
	rsync -av --delete --exclude-from=excluded-build.files chrome/skin/ build/skin/classic/asterisk-ext/
	rm -f build/asterisk-ext/chrome/asterisk-ext.jar
	cd build ; zip -r asterisk-ext/chrome/asterisk-ext.jar content locale skin

lang: $(LANGS)

$(LANGS): lang-us
	mkdir -p build/locale-po/$@
	cp ${TRDIR}/asterisk-ext.dtd/$@.po build/locale-po/$@/asterisk-ext.dtd.po
	cp ${TRDIR}/asterisk-ext.properties/$@.po build/locale-po/$@/asterisk-ext.properties.po
	mkdir -p build/locale/$@/asterisk-ext
	po2moz -i build/locale-po/$@/ -o build/locale/$@/asterisk-ext/ -t chrome/locale/en-US/
	cat chrome-locale.manifest.tpl | sed "s/##LOCALE##/$@/g" >> build/asterisk-ext/chrome.manifest

lang-us: build-dir chrome-manifest
	mkdir -p build/locale/en-US/asterisk-ext
	rsync -av --delete --exclude-from=excluded-build.files chrome/locale/en-US/ build/locale/en-US/asterisk-ext/
	cat chrome-locale.manifest.tpl | sed "s/##LOCALE##/en-US/g" >> build/asterisk-ext/chrome.manifest

chrome-manifest:
	cat chrome-jar.manifest > build/asterisk-ext/chrome.manifest

build-dir:
	mkdir -p build/asterisk-ext

clean:
	rm -rf build


