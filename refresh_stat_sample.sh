#!/bin/bash
BASEDIR=/home/grad02/deronne/.www/traffic
cd $BASEDIR
wget -q -O $BASEDIR/stat_sample.xml.gz http://data.dot.state.mn.us/iris_xml/stat_sample.xml.gz
rm -f stat_sample.xml
gzip -d stat_sample.xml.gz
mv stat_sample.xml stat_sample_latest.xml
chmod 755 stat_sample_latest.xml
