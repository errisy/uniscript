FROM public.ecr.aws/lambda/nodejs:14

RUN yum -y update
# RUN yum -y install unixODBC unixODBC-devel

# copy all files
COPY . .

# install node_modules
RUN npm install
RUN npm run build

# lambda docker entry
CMD [ "lambda_entry.handler" ]